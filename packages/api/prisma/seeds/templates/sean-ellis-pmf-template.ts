/**
 * Sean Ellis PMF Survey Template
 *
 * Structured 30-minute CAB session template for Product-Market Fit measurement.
 * Reference: Sean Ellis PMF survey methodology (the "very disappointed" question).
 *
 * Used by MADFAM-internal Tezca CAB (RFC 0013 Wave PMF-3, ADR-003).
 *
 * Schema notes:
 * - Coforma's `Session` model stores agenda as `agendaItems Json?`. We model the
 *   structured questionnaire here as a typed object that downstream UI / facilitator
 *   tooling can render. The `template_id` is what gets stamped onto sessions seeded
 *   for the Tezca CAB and is also the discriminator the Tulana webhook uses to know
 *   how to compute `sentiment_score`.
 * - Conditional questions (Q2/Q3) carry `show_when` rules so the facilitator UI can
 *   skip them dynamically. Until that UI ships, facilitators apply the rule manually.
 */

export type PMFAnswerOption = {
  value: string;
  label: string;
  /** Sentiment weight in the 0..1 range. Used by the outbound webhook scorer. */
  weight: number;
};

export type PMFQuestion = {
  id: string;
  prompt: string;
  type: 'radio' | 'text';
  required: boolean;
  options?: PMFAnswerOption[];
  /** Conditional display: only show if another question has one of these values. */
  show_when?: { question_id: string; in: string[] };
  /** Hint shown to facilitator. */
  facilitator_note?: string;
};

export type PMFSessionTemplate = {
  template_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  source: string;
  version: string;
  questions: PMFQuestion[];
  /**
   * Maps Q1 radio values to a sentiment weight in [0, 1].
   * Used by the Tulana outbound webhook (CabEventWebhookService) to compute
   * sentiment_score until v0.2 NLP analysis lands for free-text answers.
   */
  sentiment_map: Record<string, number>;
};

export const SEAN_ELLIS_PMF_TEMPLATE: PMFSessionTemplate = {
  template_id: 'sean-ellis-pmf-v1',
  name: 'Sean Ellis PMF Survey',
  description:
    'Structured 30-minute CAB session built around the Sean Ellis "very disappointed" question. ' +
    'Q1 anchors the quantitative PMF signal; Q2/Q3 surface the value proposition language and ICP; ' +
    'Q4/Q5 surface improvement vectors for roadmap-linkage.',
  duration_minutes: 30,
  source: 'https://www.startup-marketing.com/the-startup-pyramid/',
  version: '1.0.0',
  questions: [
    {
      id: 'q1_disappointment',
      prompt: 'How would you feel if you could no longer use Tezca?',
      type: 'radio',
      required: true,
      options: [
        { value: 'very_disappointed', label: 'Very disappointed', weight: 1.0 },
        { value: 'somewhat_disappointed', label: 'Somewhat disappointed', weight: 0.6 },
        { value: 'not_disappointed', label: 'Not disappointed (it isn\'t really that useful)', weight: 0.2 },
        { value: 'na', label: 'N/A — I no longer use Tezca', weight: 0.5 },
      ],
      facilitator_note:
        'This is the core PMF anchor. Aim for a representative cohort: ≥40% "very disappointed" is the standard PMF threshold.',
    },
    {
      id: 'q2_primary_benefit',
      prompt: 'What is the primary benefit you receive from Tezca?',
      type: 'text',
      required: true,
      show_when: { question_id: 'q1_disappointment', in: ['very_disappointed'] },
      facilitator_note:
        'Capture the customer\'s exact language. This is positioning copy gold.',
    },
    {
      id: 'q3_ideal_user',
      prompt: 'What type of person do you think would benefit most from Tezca?',
      type: 'text',
      required: true,
      show_when: { question_id: 'q1_disappointment', in: ['very_disappointed'] },
      facilitator_note:
        'Use to refine the ICP. Patterns across "very disappointed" answers reveal the high-fit segment.',
    },
    {
      id: 'q4_improvement',
      prompt: 'How can we improve Tezca for you?',
      type: 'text',
      required: true,
      facilitator_note:
        'Always asked. Feed concrete suggestions into Linear/Jira for roadmap-linkage.',
    },
    {
      id: 'q5_anything_else',
      prompt: 'Anything else you\'d like to share?',
      type: 'text',
      required: false,
      facilitator_note:
        'Catch-all. Often surfaces lateral insights (pricing, competitor mentions, integration asks).',
    },
  ],
  sentiment_map: {
    very_disappointed: 1.0,
    somewhat_disappointed: 0.6,
    not_disappointed: 0.2,
    na: 0.5,
  },
};

/**
 * Convenience helper used by the seed script: produces the JSON shape
 * stored on a Session.agendaItems column when scheduling a templated session.
 */
export function buildSeanEllisAgenda(): Record<string, unknown> {
  return {
    template_id: SEAN_ELLIS_PMF_TEMPLATE.template_id,
    template_version: SEAN_ELLIS_PMF_TEMPLATE.version,
    name: SEAN_ELLIS_PMF_TEMPLATE.name,
    duration_minutes: SEAN_ELLIS_PMF_TEMPLATE.duration_minutes,
    questions: SEAN_ELLIS_PMF_TEMPLATE.questions,
    sentiment_map: SEAN_ELLIS_PMF_TEMPLATE.sentiment_map,
  };
}
