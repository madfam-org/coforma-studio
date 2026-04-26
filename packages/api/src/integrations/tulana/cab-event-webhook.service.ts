/**
 * Tulana CAB Event Webhook Service
 *
 * Outbound integration: when a Coforma CAB session is marked COMPLETED, fire a
 * signed HMAC-SHA256 webhook to Tulana's `/v1/pmf/coforma-event` endpoint.
 *
 * Contract owner: ADR-003 (Tulana ↔ Coforma Integration), §"Architectural contract".
 * Reference: RFC 0013 Wave PMF-3.
 *
 * Design notes:
 *  - **Fire-and-forget.** Webhook delivery failures are logged but never bubble up
 *    to fail the session-completion transaction. PMF scoring is downstream and can
 *    tolerate eventual consistency. Retry policy lives in Tulana, not here (Tulana
 *    can re-pull the latest 5 sessions via its inbound read API per ADR-003).
 *  - **No PII in payload.** Per ADR-003, the webhook carries aggregate sentiment,
 *    summary, and roadmap-link IDs — never participant emails or free-text answers.
 *  - **v0.1 scoring** is a simple weighted average of the Q1 sentiment_map weight
 *    plus a neutral 0.5 contribution per text answer. v0.2 will replace the text
 *    contribution with a real NLP sentiment classifier (deferred).
 *  - **Templating:** the service expects a session whose `agendaItems` JSON column
 *    matches the `sean-ellis-pmf-v1` template (or another template that exposes a
 *    compatible `sentiment_map`). Sessions without a recognized template skip
 *    sentiment computation and emit `sentiment_score = 0.5` (neutral).
 */

import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Session } from '@prisma/client';

import { LoggerService } from '../../lib/logger/logger.service';

const SERVICE_NAME = 'TulanaCabEventWebhookService';
const DEFAULT_TULANA_URL = 'https://api.tulana.madfam.io';
const DEFAULT_TIMEOUT_MS = 5_000;
const NEUTRAL_SENTIMENT = 0.5;
const KNOWN_TEMPLATE_IDS = new Set(['sean-ellis-pmf-v1']);

export type CabEventType =
  | 'cab_session_completed'
  | 'feedback_submitted'
  | 'roadmap_item_linked';

export interface CabSessionAnswer {
  question_id: string;
  /** Raw answer value: radio option key or free-text string. */
  value: string | null;
  /** Question type as seen at time of answer. */
  type: 'radio' | 'text';
}

export interface CabSessionCompletionInput {
  productSlug: 'tezca' | 'karafiel' | 'cotiza' | 'dhanam' | 'selva';
  session: Pick<Session, 'id' | 'scheduledAt' | 'agendaItems'>;
  answers: CabSessionAnswer[];
  participantCount: number;
  /** Linked external roadmap items (e.g. Linear / Jira IDs). Optional. */
  linkedRoadmapItems?: string[];
  /** Operator-facing summary (≤500 chars per ADR-003). */
  summary: string;
}

export interface TulanaCoformaEventPayload {
  event_type: CabEventType;
  product_slug: string;
  session_id: string;
  session_date: string;
  sentiment_score: number;
  summary: string;
  linked_roadmap_items: string[];
  participant_count: number;
}

@Injectable()
export class TulanaCabEventWebhookService {
  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Public entrypoint — call this from session.service.ts when transitioning a
   * session to COMPLETED. Always returns; never throws.
   */
  async emitSessionCompleted(input: CabSessionCompletionInput): Promise<void> {
    const sentimentScore = this.computeSentimentScore(input);
    const payload: TulanaCoformaEventPayload = {
      event_type: 'cab_session_completed',
      product_slug: input.productSlug,
      session_id: input.session.id,
      session_date: input.session.scheduledAt.toISOString(),
      sentiment_score: sentimentScore,
      summary: this.truncate(input.summary, 500),
      linked_roadmap_items: input.linkedRoadmapItems ?? [],
      participant_count: input.participantCount,
    };

    await this.dispatch(payload);
  }

  /**
   * v0.1 sentiment scorer. Conservative, deterministic, easily testable.
   *
   * Algorithm:
   *  1. Read `sentiment_map` from the session's stamped agenda template.
   *  2. Find Q1 (the disappointment radio); map its value to a weight.
   *  3. For each answered free-text question, contribute NEUTRAL_SENTIMENT (0.5).
   *  4. Return the average. Anchored Q1 weight roughly dominates because Q1 is
   *     present-or-absent in every Sean Ellis session.
   *
   * Deferred to v0.2: real NLP sentiment classification of free-text answers.
   */
  computeSentimentScore(input: CabSessionCompletionInput): number {
    const agenda = (input.session.agendaItems ?? null) as
      | { template_id?: string; sentiment_map?: Record<string, number> }
      | null;

    if (!agenda || !agenda.template_id || !KNOWN_TEMPLATE_IDS.has(agenda.template_id)) {
      this.logger.warn(
        `Session ${input.session.id} has no recognized template; emitting neutral sentiment.`,
        SERVICE_NAME,
      );
      return NEUTRAL_SENTIMENT;
    }

    const sentimentMap = agenda.sentiment_map ?? {};
    const weights: number[] = [];

    for (const answer of input.answers) {
      if (answer.type === 'radio' && answer.value && answer.value in sentimentMap) {
        weights.push(sentimentMap[answer.value]);
      } else if (answer.type === 'text' && answer.value && answer.value.trim().length > 0) {
        // v0.1 stub: text answers contribute neutral until NLP lands.
        weights.push(NEUTRAL_SENTIMENT);
      }
    }

    if (weights.length === 0) {
      return NEUTRAL_SENTIMENT;
    }

    const avg = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    // Clamp defensively to [0, 1] in case a future template ships a bad weight.
    return Math.max(0, Math.min(1, Number(avg.toFixed(4))));
  }

  /**
   * Sign and POST. Logs success/failure. Never throws.
   */
  private async dispatch(payload: TulanaCoformaEventPayload): Promise<void> {
    const secret = this.config.get<string>('TULANA_PMF_WEBHOOK_SECRET');
    const baseUrl = this.config.get<string>('TULANA_API_URL') ?? DEFAULT_TULANA_URL;
    const url = `${baseUrl.replace(/\/$/, '')}/v1/pmf/coforma-event`;

    if (!secret) {
      this.logger.error(
        'TULANA_PMF_WEBHOOK_SECRET is not set; skipping outbound CAB event webhook. ' +
          `Session ${payload.session_id} will not be reflected in Tulana PMF score until the secret is configured.`,
        undefined,
        SERVICE_NAME,
      );
      return;
    }

    const body = JSON.stringify(payload);
    const signature = this.signPayload(body, secret);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-coforma-signature': signature,
          'user-agent': 'coforma-studio/cab-event-webhook',
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.error(
          `Tulana webhook responded ${response.status} for session ${payload.session_id}`,
          undefined,
          SERVICE_NAME,
        );
        return;
      }

      this.logger.log(
        `Dispatched ${payload.event_type} for session ${payload.session_id} ` +
          `(sentiment=${payload.sentiment_score}, status=${response.status})`,
        SERVICE_NAME,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to dispatch Tulana webhook for session ${payload.session_id}: ${message}`,
        err instanceof Error ? err.stack : undefined,
        SERVICE_NAME,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** HMAC-SHA256 in the canonical `sha256=<hex>` format expected by Tulana. */
  private signPayload(body: string, secret: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    return `sha256=${hmac.digest('hex')}`;
  }

  private truncate(input: string, max: number): string {
    if (input.length <= max) return input;
    return `${input.slice(0, max - 1)}…`;
  }
}
