import { createAnthropicAdapter } from './anthropic.js';
import { createOpenAiAdapter } from './openai.js';
import type { ProviderAdapter, ProviderCredential } from './types.js';

/**
 * Which provider id maps to which adapter, in one place.
 *
 * There were two copies of this decision — the gateway's routing table and the
 * credential test endpoint's ternary — and they had already drifted in the way
 * two copies do: adding a provider to one left the other silently answering
 * "connection testing is not implemented". One table, used by both.
 */

/**
 * Groq speaks the OpenAI wire format at its own address.
 *
 * So it reuses that adapter rather than getting a near-identical copy. What
 * makes it a different PROVIDER is the credential and the endpoint, not the
 * protocol — which is also why its models carry `providerId: 'groq'` even
 * though their ids begin with `openai/`.
 */
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Providers with a working adapter.
 *
 * `google` is deliberately absent: `gemini-2.0-flash` is in the model registry
 * but nothing can call it, and a provider offered in a credential form that
 * then cannot make a request is worse than one that is not offered.
 */
export const SUPPORTED_PROVIDER_IDS = ['anthropic', 'openai', 'groq'] as const;

export type SupportedProviderId = (typeof SUPPORTED_PROVIDER_IDS)[number];

export function isSupportedProviderId(value: string): value is SupportedProviderId {
  return (SUPPORTED_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Build the adapter for a provider, or null when there is none.
 *
 * A credential's own `baseUrl` always wins over a provider default: it is the
 * BYOK escape hatch for a self-hosted or proxied deployment, and a default
 * that overrode it would make the field a lie. Adapters validate it with
 * @moka/net before use.
 */
export function createProviderAdapter(
  providerId: string,
  credential: ProviderCredential,
): ProviderAdapter | null {
  switch (providerId) {
    case 'anthropic':
      return createAnthropicAdapter(credential);
    case 'openai':
      return createOpenAiAdapter(credential);
    case 'groq':
      return createOpenAiAdapter({
        ...credential,
        baseUrl: credential.baseUrl ?? GROQ_BASE_URL,
      });
    default:
      return null;
  }
}

/**
 * The cheapest model to send one token to when proving a credential works.
 *
 * Per provider, because "the smallest thing you offer" is a provider fact. A
 * connection test that reached for an expensive model would charge somebody
 * real money to answer "is this key valid".
 */
export const PING_MODEL_BY_PROVIDER: Readonly<Record<SupportedProviderId, string>> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
  groq: 'openai/gpt-oss-20b',
};
