/**
 * POST /api/v1/webhooks/phynecrm
 *
 * Receives signed webhook events from PhyneCRM. Always returns 200
 * after successful signature verification — handler-level failures are
 * logged but not propagated, so PhyneCRM's retry logic doesn't loop.
 * Signature failures return 401 / 400.
 */

import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { LoggerService } from '../../lib/logger/logger.service';
import { PhyneCrmEvent, PhyneCrmWebhookService } from './phynecrm-webhook.service';

@Controller('api/v1/webhooks/phynecrm')
export class PhyneCrmWebhookController {
  private readonly context = 'PhyneCrmWebhookController';

  constructor(
    private readonly service: PhyneCrmWebhookService,
    private readonly logger: LoggerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() req: Request,
    @Headers('x-madfam-signature') signatureHeader: string | undefined,
    @Body() _body: unknown,
  ): Promise<{ received: boolean; processed: boolean; note?: string }> {
    // We need the raw body for HMAC. NestJS gives us the parsed JSON in
    // `_body`; the raw bytes live on `req.rawBody` if `bodyParser` was
    // configured to preserve them. Fall back to re-stringifying the
    // parsed JSON — this matches RouteCraft / cotiza pattern. Producers
    // MUST sign the canonical JSON body that they send.
    const rawBody =
      (req as Request & { rawBody?: Buffer | string }).rawBody?.toString() ??
      JSON.stringify(_body);

    const verification = this.service.verifySignature(rawBody, signatureHeader);
    if (!verification.ok) {
      this.logger.warn(
        `PhyneCRM webhook signature rejected: ${verification.reason}`,
        this.context,
      );
      throw new UnauthorizedException({ error: 'invalid_signature', reason: verification.reason });
    }

    const event = _body as PhyneCrmEvent;
    if (!event || typeof event !== 'object' || !('type' in event) || !('data' in event)) {
      // Verified-but-malformed bodies still log success (signature was
      // valid) and ack so producers don't retry; the operator gets the
      // log line.
      this.logger.warn('PhyneCRM webhook payload missing type/data', this.context);
      return { received: true, processed: false, note: 'malformed_payload' };
    }

    const result = await this.service.handleEvent(event);
    return { received: true, ...result };
  }
}
