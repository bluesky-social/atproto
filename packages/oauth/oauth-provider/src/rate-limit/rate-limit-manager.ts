import { RateLimitExceededError } from '../errors/rate-limit-exceeded-error.js'
import type { HCaptchaManager } from '../hcaptcha/hcaptcha-manager.js'
import {
  DEFAULT_RATE_LIMIT_POLICIES,
  type RateLimitContext,
  type RateLimitDevicePolicy,
  type RateLimitKeyGetter,
  type RateLimitPolicyContexts,
  type RateLimitPolicyName,
  type RateLimitRule,
  type RateLimitsOptions,
  isRateLimitDevicePolicyName,
} from './rate-limit-policies.js'
import type { RateLimiter, RateLimiterConsumeResult } from './rate-limiter.js'

type Tier = 'captcha' | 'block'

type BoundRule<C extends RateLimitContext> = {
  key: RateLimitKeyGetter<C>
  limiter: RateLimiter
}

type BoundPolicy<C extends RateLimitContext> = Record<
  Tier,
  readonly BoundRule<C>[]
>

type BoundPolicies = {
  readonly [P in RateLimitPolicyName]: BoundPolicy<RateLimitPolicyContexts[P]>
}

/**
 * Enforces the {@link RateLimitsOptions.policies rate limit policies}. When a
 * policy has a captcha tier, exceeding it requires a valid hCaptcha token
 * (verified through the {@link HCaptchaManager}), while exceeding the block
 * tier rejects the request.
 *
 * When no rate limits are configured, only the default rules that have no
 * points (which need no storage) are enforced.
 */
export class RateLimitManager {
  protected readonly policies: BoundPolicies

  constructor(
    protected readonly hcaptchaManager: HCaptchaManager,
    options?: RateLimitsOptions,
  ) {
    const bindRules = <C extends RateLimitContext>(
      policy: RateLimitPolicyName,
      tier: Tier,
      rules: readonly RateLimitRule<C>[] = [],
    ): BoundRule<C>[] =>
      rules.flatMap(({ key, points, durationMs }, index) => {
        if (points <= 0) {
          return [{ key, limiter: exceededLimiter(points, durationMs) }]
        }

        if (!options) return []

        // @NOTE The name is likely to be used as a storage key prefix by the
        // factory, so it must be stable across deploys. Since rules are only
        // identified by their position, the window is part of the name: should
        // the rules of a tier be reordered, a rule must never inherit the
        // counters of a rule with a different window (e.g. a 5 minutes rule
        // inheriting a daily count would block its keys for up to a day).
        const name = `oauth-${policy}-${tier}-${index}-${durationMs}`

        return [
          {
            key,
            limiter: options.factory({ name, points, durationMs }),
          },
        ]
      })

    const bindPolicy = <P extends RateLimitPolicyName>(
      policy: P,
      defaults: RateLimitDevicePolicy,
    ): BoundPolicy<RateLimitPolicyContexts[P]> => {
      const supportsCaptcha = isRateLimitDevicePolicyName(policy)
      const { captcha, block } = (options?.policies?.[policy] || {}) as Partial<
        RateLimitDevicePolicy<any>
      >

      // @NOTE Enforced by the types, unless they were bypassed
      if (!supportsCaptcha && captcha != null) {
        throw new TypeError(
          `The "${policy}" rate limit policy does not support a captcha tier`,
        )
      }

      const boundPolicy: BoundPolicy<any> = {
        captcha:
          hcaptchaManager.enabled && supportsCaptcha
            ? bindRules(policy, 'captcha', captcha ?? defaults.captcha)
            : [],
        block: bindRules(policy, 'block', block ?? defaults.block),
      }

      return boundPolicy
    }

    this.policies = Object.fromEntries(
      (
        Object.entries(DEFAULT_RATE_LIMIT_POLICIES) as [
          RateLimitPolicyName,
          RateLimitDevicePolicy,
        ][]
      ).map(([name, defaults]) => [name, bindPolicy(name, defaults)]),
    ) as BoundPolicies
  }

  /**
   * Consumes one point from every applicable rule of the `action`'s policy.
   * When a captcha tier rule is exceeded, the hCaptcha token of the form input
   * (`ctx.data`) is verified.
   *
   * @throws {RateLimitExceededError} if any block tier rule is exceeded
   * @throws {CaptchaRequiredError} if any captcha tier rule is exceeded and the
   * form input carries no hCaptcha token
   * @throws {CaptchaRejectedError} if the hCaptcha token's verification failed
   */
  public async consume<P extends RateLimitPolicyName>(
    policy: P,
    ctx: RateLimitPolicyContexts[P],
  ): Promise<void> {
    const bound: BoundPolicy<RateLimitPolicyContexts[P]> = this.policies[policy]

    const [captchaResults, blockResults] = await Promise.all([
      consumeAll(bound.captcha, ctx),
      consumeAll(bound.block, ctx),
    ])

    if (blockResults.some(isExceeded)) {
      const msBeforeNext = Math.max(
        ...blockResults.filter(isExceeded).map((s) => s.msBeforeNext),
      )
      throw new RateLimitExceededError(msBeforeNext)
    }

    // @NOTE the kind check is only necessary for TS: BoundPolicy will never
    // have any captcha rules for non-device contexts (see supportsCaptcha)
    if (ctx.kind === 'device' && captchaResults.some(isExceeded)) {
      await this.hcaptchaManager.verify(
        ctx.deviceId,
        ctx.deviceMetadata,
        ctx.data,
      )
    }
  }
}

/**
 * The limiter of a rule that has no points: every request exceeds it.
 */
function exceededLimiter(points: number, durationMs: number): RateLimiter {
  return {
    consume: async (_key, consumed) => ({
      remainingPoints: points - consumed,
      msBeforeNext: durationMs,
    }),
  }
}

function consumeAll<C extends RateLimitContext>(
  rules: readonly BoundRule<C>[],
  ctx: C,
): Promise<RateLimiterConsumeResult[]> {
  return Promise.all(
    rules.flatMap(({ key, limiter }) => {
      const keyValue = key(ctx)
      return keyValue == null ? [] : [limiter.consume(keyValue, 1)]
    }),
  )
}

function isExceeded(result: RateLimiterConsumeResult): boolean {
  return result.remainingPoints < 0
}
