import {
  DEFAULT_FORBIDDEN_DOMAIN_NAMES,
  type Fetch,
  type ProtocolConfig,
  type UrlPolicyReason,
  asRequest,
  checkForbiddenDomainNamePolicy,
  checkHostHeaderPolicy,
  checkProtocolPolicy,
  explicitRedirectCheckRequestTransform,
  fetchMaxSizeProcessor,
  forbiddenDomainNameRequestTransform,
  protocolCheckRequestTransform,
  requireHostHeaderTransform,
  timedFetch,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'
import { safeDispatchFetchWrap } from './dispatch.js'
import { checkUnicastPolicy, unicastLookup } from './unicast.js'

export type SafeFetchWrapOptions<C> = {
  fetch?: Fetch<C>
  responseMaxSize?: number
  ssrfProtection?: boolean
  allowCustomPort?: boolean
  allowData?: boolean
  allowHttp?: boolean
  allowIpHost?: boolean
  allowPrivateIps?: boolean
  timeout?: number
  forbiddenDomainNames?: Iterable<string>
  /**
   * When `false`, a {@link RequestInit['redirect']} value must be explicitly
   * provided as second argument to the returned function or requests will fail.
   *
   * @default false
   */
  allowImplicitRedirect?: boolean
}

/**
 * Wrap a fetch function with safety checks so that it can be safely used
 * with user provided input (URL).
 *
 * @see {@link https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html}
 *
 * @note The url policy is enforced twice, deliberately. The request transforms
 * below apply it to the initial url, where a rejection can carry the caller's
 * own {@link Request} and can reject schemes (`data:`, `file:`) that never
 * reach the network. The dispatcher guard applies the same policy to every
 * request that is actually issued, which is the only way to cover redirect
 * hops: `fetch()` follows redirects internally, above the dispatcher, so a
 * transform only ever observes the url it was handed.
 *
 * @note When {@link SafeFetchWrapOptions.allowImplicitRedirect} is `false`
 * (default), then the returned function **must** be called setting the second
 * argument's `redirect` property to one of the allowed values. Otherwise, if
 * the returned fetch function is called with a `Request` object (and no
 * explicit `redirect` init object), then the verification code will not be able
 * to determine if the `redirect` property was explicitly set or based on the
 * default value (`follow`), causing it to preventively block the request (throw
 * an error). For this reason, unless you set
 * {@link SafeFetchWrapOptions.allowImplicitRedirect} to `true`, you should
 * **not** wrap the returned function into another function that creates a
 * {@link Request} object before passing it to the function (as a e.g. a logging
 * function would).
 */
export function safeFetchWrap<C>({
  fetch = globalThis.fetch as Fetch<C>,
  responseMaxSize = 512 * 1024, // 512kB
  ssrfProtection = true,
  allowCustomPort = !ssrfProtection,
  allowData = false,
  allowHttp = !ssrfProtection,
  allowIpHost = true,
  allowPrivateIps = !ssrfProtection,
  timeout = 10e3,
  forbiddenDomainNames = DEFAULT_FORBIDDEN_DOMAIN_NAMES as Iterable<string>,
  allowImplicitRedirect = false,
}: SafeFetchWrapOptions<C> = {}) {
  /**
   * Prevent using http:, file: or data: protocols.
   */
  const protocols: ProtocolConfig = {
    'about:': false,
    'data:': allowData,
    'file:': false,
    'http:': allowHttp && { allowCustomPort },
    'https:': { allowCustomPort },
  }

  const forbiddenDomainNameSet = new Set<string>(forbiddenDomainNames)

  /**
   * The whole url policy, as a single check over a {@link URL}, so that it can
   * be applied to every redirect hop and not only to the initial url.
   *
   * @note {@link checkUnicastPolicy} is applied here (rather than left to the
   * connect-time DNS guard) because NodeJS does not resolve literal-IP hosts,
   * so the lookup is never invoked for them.
   */
  const checkUrl = (url: URL): UrlPolicyReason | undefined =>
    checkProtocolPolicy(url, protocols) ??
    (allowIpHost ? undefined : checkHostHeaderPolicy(url)) ??
    checkForbiddenDomainNamePolicy(url, forbiddenDomainNameSet) ??
    (allowPrivateIps ? undefined : checkUnicastPolicy(url))

  return pipe(
    /**
     * Require explicit {@link RequestInit['redirect']} mode
     */
    allowImplicitRedirect ? asRequest : explicitRedirectCheckRequestTransform(),

    /**
     * Only requests that will be issued with a "Host" header are allowed.
     */
    allowIpHost ? asRequest : requireHostHeaderTransform(),

    protocolCheckRequestTransform(protocols),

    /**
     * Disallow fetching from domains we know are not atproto/OIDC client
     * implementation. Note that other domains can be blocked by providing a
     * custom fetch function combined with another
     * forbiddenDomainNameRequestTransform.
     */
    forbiddenDomainNameRequestTransform(forbiddenDomainNames),

    /**
     * Since we will be fetching from the network based on user provided
     * input, let's mitigate resource exhaustion attacks by setting a timeout.
     *
     * @note This budget covers the entire redirect chain, since `fetch()`
     * follows redirects within this single call.
     */
    timedFetch(
      timeout,

      /**
       * Since we will be fetching from the network based on user provided
       * input, we need to make sure that the request is not vulnerable to SSRF
       * attacks.
       *
       * @note The dispatcher is installed even when private IPs are allowed:
       * relaxing the unicast requirement must not silently disable the
       * remaining per-hop checks. Only the DNS guard is conditional.
       */
      safeDispatchFetchWrap({
        fetch,
        checkUrl,
        lookup: allowPrivateIps ? undefined : unicastLookup,
      }),
    ),

    /**
     * Since we will be fetching user owned data, we need to make sure that an
     * attacker cannot force us to download a large amounts of data.
     */
    fetchMaxSizeProcessor(responseMaxSize),
  ) satisfies Fetch<unknown>
}
