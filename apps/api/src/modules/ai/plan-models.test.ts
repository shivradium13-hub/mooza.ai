import { describe, expect, it } from 'vitest';
import { Feature } from '@moka/billing';
import { DEFAULT_PLANS } from '@moka/billing';
import { PING_MODEL_BY_PROVIDER, SUPPORTED_PROVIDER_IDS, findModel, listModels } from '@moka/ai';

/**
 * The model registry and the plan catalogue have to agree.
 *
 * They are in different packages that cannot import each other —
 * `@moka/billing` deliberately depends on `@moka/core` alone — so nothing
 * connected the two, and they drifted: the Free plan allowed
 * `claude-haiku-4-5-20251001` while the registry called it `claude-haiku-4-5`.
 * The effect was a paying-attention-free failure. An organization with a valid
 * Anthropic key was refused its cheapest model and told it was not entitled to
 * it, which is true of the string and false of the model.
 *
 * `apps/api` is the first place that depends on both, so the check lives here.
 */

describe('plan model allowlists', () => {
  const allowlists = DEFAULT_PLANS.flatMap((plan) =>
    plan.entitlements
      .filter((entitlement) => entitlement.featureKey === Feature.AI_MODELS)
      .flatMap((entitlement) => (entitlement.allowedValues ?? []).map((id) => ({ plan: plan.key, id }))),
  );

  it('has at least one plan that names specific models', () => {
    // Otherwise this whole suite passes by having nothing to check.
    expect(allowlists.length).toBeGreaterThan(0);
  });

  it.each(allowlists)('$plan allows $id, which exists in the registry', ({ id }) => {
    expect(findModel(id), `"${id}" is in a plan allowlist but not in the model registry`).not.toBe(
      null,
    );
  });

  it('leaves every plan a model it can actually reach', () => {
    for (const plan of DEFAULT_PLANS) {
      const entitlement = plan.entitlements.find((e) => e.featureKey === Feature.AI_MODELS);
      // A null allowedValues means "the whole registry", which is fine.
      if (!entitlement?.allowedValues) continue;

      const usable = entitlement.allowedValues.filter((id) => findModel(id) !== null);
      expect(usable.length, `plan "${plan.key}" allows no model that exists`).toBeGreaterThan(0);
    }
  });
});

describe('provider wiring', () => {
  it('has a ping model for every supported provider', () => {
    for (const providerId of SUPPORTED_PROVIDER_IDS) {
      const id = PING_MODEL_BY_PROVIDER[providerId];
      expect(id, `no ping model for "${providerId}"`).toBeTruthy();
      expect(findModel(id), `ping model "${id}" is not in the registry`).not.toBe(null);
      expect(findModel(id)?.providerId).toBe(providerId);
    }
  });

  it('offers no model whose provider has no adapter', () => {
    // A model that can be routed to and then cannot be called is a failure
    // deferred to the worst moment — after the user has added a credential.
    const orphans = listModels()
      .filter((model) => !(SUPPORTED_PROVIDER_IDS as readonly string[]).includes(model.providerId))
      .map((model) => `${model.id} (${model.providerId})`);

    expect(orphans, 'these models have no adapter behind them').toEqual([]);
  });
});
