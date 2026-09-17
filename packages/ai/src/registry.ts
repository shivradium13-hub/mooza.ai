import { Capability, type ModelDescriptor } from './types.js';

/**
 * Model registry (docs/architecture.md §17).
 *
 * A CODE registry rather than a database table: model capabilities are
 * behavioural facts that the router and adapters must agree on, and a row an
 * operator can edit to claim a model supports vision when it does not is a
 * source of confusing failures. Per-organization enablement and BYOK live in
 * the database; what a model *is* lives here.
 *
 * ON PRICING
 * Anthropic figures are taken from the bundled `claude-api` reference; Groq's
 * from its own published model pages. Both carry the source and the date they
 * were read, because a price is a number people budget against and one with no
 * provenance cannot be re-checked.
 *
 * OpenAI and Google pricing could not be verified in this environment, so
 * those models carry `pricing: null` and their cost is reported as UNKNOWN
 * rather than estimated. Token counts are still tracked in full. A model with
 * null pricing is NOT free — `planDebit` records the call as unpriced and
 * charges nothing, and the Usage page says how many such calls there were, so
 * the gap is visible rather than silently zero (§45).
 */

const ANTHROPIC_PRICING_SOURCE = 'Anthropic claude-api skill reference';
const ANTHROPIC_PRICING_DATE = '2026-06-24';

function anthropicModel(params: {
  id: string;
  displayName: string;
  capabilities: readonly Capability[];
  contextWindow: number;
  inputPerMillion: number;
  outputPerMillion: number;
  routingPriority: number;
  maxOutputTokens?: number;
}): ModelDescriptor {
  return {
    id: params.id,
    providerId: 'anthropic',
    displayName: params.displayName,
    capabilities: params.capabilities,
    contextWindow: params.contextWindow,
    maxOutputTokens: params.maxOutputTokens ?? 64_000,
    pricing: {
      inputPerMillion: params.inputPerMillion,
      outputPerMillion: params.outputPerMillion,
      source: ANTHROPIC_PRICING_SOURCE,
      verifiedOn: ANTHROPIC_PRICING_DATE,
    },
    routingPriority: params.routingPriority,
    status: 'available',
  };
}

const GROQ_PRICING_SOURCE = 'https://console.groq.com/docs/models';
const GROQ_PRICING_DATE = '2026-09-17';

function groqModel(params: {
  id: string;
  displayName: string;
  capabilities: readonly Capability[];
  contextWindow: number;
  maxOutputTokens: number;
  inputPerMillion: number;
  outputPerMillion: number;
  routingPriority: number;
}): ModelDescriptor {
  return {
    id: params.id,
    providerId: 'groq',
    displayName: params.displayName,
    capabilities: params.capabilities,
    contextWindow: params.contextWindow,
    maxOutputTokens: params.maxOutputTokens,
    pricing: {
      inputPerMillion: params.inputPerMillion,
      outputPerMillion: params.outputPerMillion,
      source: GROQ_PRICING_SOURCE,
      verifiedOn: GROQ_PRICING_DATE,
    },
    routingPriority: params.routingPriority,
    status: 'available',
  };
}

/** Pricing deliberately unknown — see the note above. */
function unpricedModel(params: {
  id: string;
  providerId: string;
  displayName: string;
  capabilities: readonly Capability[];
  contextWindow: number;
  maxOutputTokens: number;
  routingPriority: number;
  status?: ModelDescriptor['status'];
}): ModelDescriptor {
  return { ...params, pricing: null, status: params.status ?? 'available' };
}

const FULL = [
  Capability.TEXT,
  Capability.VISION,
  Capability.TOOLS,
  Capability.REASONING,
  Capability.LONG_CONTEXT,
] as const;

export const MODELS: readonly ModelDescriptor[] = [
  // --- Anthropic -----------------------------------------------------------
  anthropicModel({
    id: 'claude-opus-5',
    displayName: 'Claude Opus 5',
    capabilities: FULL,
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    inputPerMillion: 5,
    outputPerMillion: 25,
    // The documented default for general work.
    routingPriority: 10,
  }),
  anthropicModel({
    id: 'claude-sonnet-5',
    displayName: 'Claude Sonnet 5',
    capabilities: FULL,
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    inputPerMillion: 2,
    outputPerMillion: 10,
    routingPriority: 20,
  }),
  anthropicModel({
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    capabilities: [Capability.TEXT, Capability.VISION, Capability.TOOLS, Capability.FAST, Capability.CHEAP],
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    inputPerMillion: 1,
    outputPerMillion: 5,
    routingPriority: 30,
  }),
  anthropicModel({
    id: 'claude-fable-5-1',
    displayName: 'Claude Fable 5.1',
    capabilities: FULL,
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    inputPerMillion: 10,
    outputPerMillion: 50,
    // Most capable, most expensive: chosen only when asked for explicitly.
    routingPriority: 5,
  }),
  anthropicModel({
    id: 'claude-opus-4-8',
    displayName: 'Claude Opus 4.8',
    capabilities: FULL,
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    inputPerMillion: 5,
    outputPerMillion: 25,
    routingPriority: 15,
  }),

  // --- OpenAI (pricing unverified in this build) ----------------------------
  unpricedModel({
    id: 'gpt-4o',
    providerId: 'openai',
    displayName: 'GPT-4o',
    capabilities: [Capability.TEXT, Capability.VISION, Capability.TOOLS],
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    routingPriority: 40,
  }),
  unpricedModel({
    id: 'gpt-4o-mini',
    providerId: 'openai',
    displayName: 'GPT-4o mini',
    capabilities: [Capability.TEXT, Capability.VISION, Capability.TOOLS, Capability.FAST, Capability.CHEAP],
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    routingPriority: 50,
  }),

  /*
   * --- Google ---------------------------------------------------------------
   *
   * DESCRIBED, NOT CALLABLE. There is no Google adapter, so nothing can reach
   * this model — and until now it said `available`, which put it in the
   * catalogue as something a user could choose. Picking it got them "no
   * adapter registered for provider google", a sentence about our code
   * delivered as though it were about their request.
   *
   * Kept rather than deleted, because the description is correct and is what
   * an adapter would be written against. `unimplemented` is the honest state:
   * we know the model, we cannot call it.
   */
  unpricedModel({
    id: 'gemini-2.0-flash',
    providerId: 'google',
    displayName: 'Gemini 2.0 Flash',
    capabilities: [Capability.TEXT, Capability.VISION, Capability.TOOLS, Capability.FAST, Capability.LONG_CONTEXT],
    contextWindow: 1_000_000,
    maxOutputTokens: 8_192,
    routingPriority: 45,
    status: 'unimplemented',
  }),

  /*
   * --- Groq -----------------------------------------------------------------
   *
   * OPEN-WEIGHT MODELS ON GROQ'S OWN HARDWARE, at roughly 500 tokens/second.
   * Priced and dated from Groq's published model pages, unlike OpenAI and
   * Google below, so cost reporting works for these.
   *
   * THE IDS REALLY DO BEGIN WITH `openai/`. These are OpenAI's open-weight
   * gpt-oss models, served by Groq; `openai/gpt-oss-120b` is the exact string
   * Groq's API expects. It is not a typo and it is not the OpenAI provider —
   * `providerId` is what decides whose credential and whose endpoint is used.
   *
   * Groq's Llama models are deliberately absent: `llama-3.1-8b-instant` and
   * `llama-3.3-70b-versatile` were shut down for free and developer tiers on
   * 2026-08-16, and Groq names these two as the migration path. Registering a
   * model that no longer answers would turn a dead id into a routing failure
   * nobody could explain.
   *
   * No VISION on either: gpt-oss takes text only, confirmed on the model
   * pages. No LONG_CONTEXT either — 131k is a large window but below the
   * threshold at which the router asks for that capability, and claiming it
   * would route 150k-token requests to a model that cannot hold them.
   */
  groqModel({
    id: 'openai/gpt-oss-120b',
    displayName: 'GPT-OSS 120B (Groq)',
    capabilities: [Capability.TEXT, Capability.TOOLS, Capability.REASONING, Capability.FAST],
    contextWindow: 131_072,
    maxOutputTokens: 65_536,
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    // Ahead of gpt-4o: same input price as gpt-4o-mini, far faster, and with
    // a real cost figure attached rather than an unknown one.
    routingPriority: 35,
  }),
  groqModel({
    id: 'openai/gpt-oss-20b',
    displayName: 'GPT-OSS 20B (Groq)',
    capabilities: [
      Capability.TEXT,
      Capability.TOOLS,
      Capability.REASONING,
      Capability.FAST,
      Capability.CHEAP,
    ],
    contextWindow: 131_072,
    maxOutputTokens: 65_536,
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
    routingPriority: 55,
  }),
];

const BY_ID = new Map(MODELS.map((model) => [model.id, model]));

export function findModel(modelId: string): ModelDescriptor | null {
  return BY_ID.get(modelId) ?? null;
}

export function listModels(options: { providerId?: string } = {}): readonly ModelDescriptor[] {
  return MODELS.filter(
    (model) =>
      model.status === 'available' &&
      (!options.providerId || model.providerId === options.providerId),
  );
}

export function modelsWithCapabilities(
  required: readonly Capability[],
): readonly ModelDescriptor[] {
  return listModels()
    .filter((model) => required.every((capability) => model.capabilities.includes(capability)))
    .toSorted((a, b) => a.routingPriority - b.routingPriority);
}

/** The registry's default when a caller expresses no preference. */
export const DEFAULT_MODEL_ID = 'claude-opus-5';
