import { DAY, HOUR, MINUTE } from '@atproto/common'
import type { ClientAuth } from '../client/client-auth.js'
import type { Client } from '../client/client.js'
import type { DeviceId } from '../device/device-id.js'
import type { HcaptchaVerifyData } from '../hcaptcha/hcaptcha-manager.js'
import type { RequestMetadata } from '../lib/http/request.js'
import { normalizeIdentifierString } from '../lib/identifier.js'
import type { RateLimiterFactory } from './rate-limiter.js'

const RATE_LIMIT_DEVICE_POLICIES = Object.freeze([
  'sign-in',
  'sign-up',
  'reset-password-request',
  'reset-password-confirm',
] as const)

export const isRateLimitDevicePolicyName = (
  policy: string,
): policy is RateLimitDevicePolicyName => {
  return (RATE_LIMIT_DEVICE_POLICIES as readonly string[]).includes(policy)
}

export type RateLimitDevicePolicyName =
  (typeof RATE_LIMIT_DEVICE_POLICIES)[number]

/**
 * The context of the account routes, whose requests carry the form input
 * (including the hCaptcha token, if any).
 */
export type RateLimitDeviceContext = {
  kind: 'device'
  deviceId: DeviceId
  deviceMetadata: RequestMetadata
  data: HcaptchaVerifyData
}

export type RateLimitClientPolicyName = 'pushed-authorization-request'

/**
 * The context of the OAuth client requests, which cannot carry an hCaptcha
 * token.
 */
export type RateLimitClientContext = {
  kind: 'client'
  deviceMetadata: RequestMetadata
  client: Client
  clientAuth: ClientAuth
}

/**
 * Maps each rate limit policy to the context it provides to its rules'
 * {@link RateLimitRule.key}.
 */
export type RateLimitPolicyContexts = {
  [K in RateLimitDevicePolicyName]: RateLimitDeviceContext
} & {
  [K in RateLimitClientPolicyName]: RateLimitClientContext
}

export type RateLimitPolicyName =
  RateLimitDevicePolicyName | RateLimitClientPolicyName
export type RateLimitContext = RateLimitDeviceContext | RateLimitClientContext

/**
 * @returns the key to count the request under, or `null` for the rule not to
 * apply to the request.
 */
export type RateLimitKeyGetter<C extends RateLimitContext = RateLimitContext> =
  (ctx: C) => string | null

export const ipKey: RateLimitKeyGetter = (ctx) => ctx.deviceMetadata.ipAddress

// @NOTE The identifier (an email address or a handle, also part of the
// `identifierIpKey`) is stored in plain text by the rate limiter backend (e.g.
// in Redis). Backends that must not hold PII should hash the keys they
// receive (e.g. with an HMAC, as a plain hash of an email address can be
// reversed by guessing).
export const identifierKey: RateLimitKeyGetter<RateLimitDeviceContext> = (
  ctx,
) => {
  const identifier =
    ctx.data.action === 'sign-up'
      ? ctx.data.input.handle
      : 'identifier' in ctx.data.input
        ? ctx.data.input.identifier
        : undefined
  return identifier ? normalizeIdentifierString(identifier) : null
}

export const identifierIpKey: RateLimitKeyGetter<RateLimitDeviceContext> = (
  ctx,
) => {
  const identifier = identifierKey(ctx)
  // @NOTE IP addresses never contain spaces, making this unambiguous
  return identifier ? `${identifier} ${ctx.deviceMetadata.ipAddress}` : null
}

/**
 * The client ID, for clients that authenticated themselves (`null` for public
 * clients).
 */
export const authenticatedClientKey: RateLimitKeyGetter<
  RateLimitClientContext
> = (ctx) => (ctx.clientAuth.method !== 'none' ? ctx.client.id : null)

/**
 * The client ID and the IP address, for public clients (`null` for clients
 * that authenticated themselves). Since anyone can claim to be a public client,
 * keying on the IP address prevents anyone from exhausting a public client's
 * budget.
 */
export const publicClientIpKey: RateLimitKeyGetter<RateLimitClientContext> = (
  ctx,
) =>
  ctx.clientAuth.method === 'none'
    ? // @NOTE Client IDs (URLs) never contain spaces
      `${ctx.client.id} ${ctx.deviceMetadata.ipAddress}`
    : null

/**
 * @note A rule's limiter is named after the rule's position in its tier and
 * its `durationMs`. Reordering the rules of a tier between deploys may cause
 * rules with the same window to swap counters, until those expire.
 * @note A rule with no `points` is exceeded by every request. Since it needs no
 * storage, it is not backed by the {@link RateLimitsOptions.factory}, and
 * applies even when no rate limits are configured.
 */
export type RateLimitRule<C extends RateLimitContext = RateLimitContext> = {
  key: RateLimitKeyGetter<C>
  points: number
  durationMs: number
}

export interface RateLimitPolicy<
  C extends RateLimitContext = RateLimitContext,
> {
  /**
   * Exceeding any of these rules rejects the request with a
   * `rate_limit_exceeded` (HTTP 429) error.
   *
   * @note Never key a rule on the identifier alone here (e.g. using
   * {@link identifierKey}), as that would allow anyone to lock a victim out of
   * their account.
   */
  block: readonly RateLimitRule<C>[]
}

export interface RateLimitDevicePolicy<
  C extends RateLimitDeviceContext = RateLimitDeviceContext,
> extends RateLimitPolicy<C> {
  /**
   * Exceeding any of these rules requires the request to carry a valid hCaptcha
   * token. Ignored when hCaptcha is not configured.
   */
  captcha: readonly RateLimitRule<C>[]
}

export type RateLimitPolicies = {
  readonly [P in RateLimitPolicyName]: P extends RateLimitDevicePolicyName
    ? RateLimitDevicePolicy<RateLimitPolicyContexts[P]>
    : RateLimitPolicy<RateLimitPolicyContexts[P]>
}

export const DEFAULT_RATE_LIMIT_POLICIES: RateLimitPolicies = {
  'sign-in': {
    captcha: [
      { key: identifierKey, points: 5, durationMs: 15 * MINUTE },
      { key: ipKey, points: 20, durationMs: 15 * MINUTE },
    ],
    block: [
      { key: identifierIpKey, points: 25, durationMs: 5 * MINUTE },
      { key: identifierIpKey, points: 50, durationMs: DAY },
      { key: ipKey, points: 100, durationMs: 5 * MINUTE },
    ],
  },
  'sign-up': {
    // @NOTE No points: every sign-up requires a captcha
    captcha: [{ key: ipKey, points: 0, durationMs: 0 }],
    block: [
      { key: ipKey, points: 20, durationMs: HOUR },
      { key: ipKey, points: 100, durationMs: DAY },
    ],
  },
  'reset-password-request': {
    captcha: [
      { key: identifierKey, points: 3, durationMs: HOUR },
      { key: ipKey, points: 5, durationMs: HOUR },
    ],
    block: [
      { key: ipKey, points: 15, durationMs: HOUR },
      { key: ipKey, points: 50, durationMs: DAY },
    ],
  },
  'reset-password-confirm': {
    captcha: [{ key: ipKey, points: 5, durationMs: 15 * MINUTE }],
    block: [{ key: ipKey, points: 50, durationMs: 5 * MINUTE }],
  },
  'pushed-authorization-request': {
    block: [
      // @NOTE Shared by all the users of the client, hence the higher limit
      { key: authenticatedClientKey, points: 3000, durationMs: 5 * MINUTE },
      // @NOTE Unauthenticated clients are typically not running on a server
      // and are initiating requests from devices with dynamic IPs.
      { key: publicClientIpKey, points: 50, durationMs: 5 * MINUTE },
    ],
  },
}

export type RateLimitsOptions = {
  factory: RateLimiterFactory

  /**
   * Overrides {@link DEFAULT_RATE_LIMIT_POLICIES}. Each tier provided replaces
   * the corresponding default tier's rules entirely.
   */
  policies?: {
    readonly [P in RateLimitPolicyName]?: Partial<RateLimitPolicies[P]>
  }
}
