import {
  DEFAULT_FORBIDDEN_DOMAIN_NAMES,
  Fetch,
  asRequest,
  explicitRedirectCheckRequestTransform,
  fetchMaxSizeProcessor,
  forbiddenDomainNameRequestTransform,
  protocolCheckRequestTransform,
  requireHostHeaderTransform,
  timedFetch,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'
import { UnicastFetchWrapOptions, unicastFetchWrap } from './unicast.js'

export type SafeFetchWrapOptions<C> = UnicastFetchWrapOptions<C> & {
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
  dangerouslyForceKeepAliveAgent = false,
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
  return pipe(
    /**
     * Require explicit {@link RequestInit['redirect']} mode
     */
    allowImplicitRedirect ? asRequest : explicitRedirectCheckRequestTransform(),

    /**
     * Only requests that will be issued with a "Host" header are allowed.
     */
    allowIpHost ? asRequest : requireHostHeaderTransform(),

    /**
     * Prevent using http:, file: or data: protocols.
     */
    protocolCheckRequestTransform({
      'about:': false,
      'data:': allowData,
      'file:': false,
      'http:': allowHttp && { allowCustomPort },
      'https:': { allowCustomPort },
    }),

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
     */
    timedFetch(
      timeout,

      /**
       * Since we will be fetching from the network based on user provided
       * input, we need to make sure that the request is not vulnerable to SSRF
       * attacks.
       */
      allowPrivateIps
        ? fetch
        : unicastFetchWrap({ fetch, dangerouslyForceKeepAliveAgent }),
    ),

    /**
     * Since we will be fetching user owned data, we need to make sure that an
     * attacker cannot force us to download a large amounts of data.
     */
    fetchMaxSizeProcessor(responseMaxSize),
  ) satisfies Fetch<unknown>
}
