import {
  DEFAULT_FORBIDDEN_DOMAIN_NAMES,
  Fetch,
  asRequest,
  fetchMaxSizeProcessor,
  forbiddenDomainNameRequestTransform,
  protocolCheckRequestTransform,
  redirectCheckRequestTransform,
  requireHostHeaderTransform,
  timedFetch,
  toRequestTransformer,
} from '@atproto-labs/fetch'
import { pipe } from '@atproto-labs/pipe'
import { unicastFetchWrap } from './unicast.js'

export type SafeFetchWrapOptions = NonNullable<
  Parameters<typeof safeFetchWrap>[0]
>

/**
 * Wrap a fetch function with safety checks so that it can be safely used
 * with user provided input (URL).
 *
 * @see {@link https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html}
 */
export function safeFetchWrap({
  fetch = globalThis.fetch as Fetch,
  responseMaxSize = 512 * 1024, // 512kB
  ssrfProtection = true,
  allowCustomPort = !ssrfProtection,
  allowData = false,
  allowHttp = !ssrfProtection,
  allowIpHost = true,
  allowPrivateIps = !ssrfProtection,
  timeout = 10e3,
  forbiddenDomainNames = DEFAULT_FORBIDDEN_DOMAIN_NAMES as Iterable<string>,
} = {}): Fetch<unknown> {
  return toRequestTransformer(
    pipe(
      /**
       * Disable HTTP redirects
       */
      redirectCheckRequestTransform(),

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
        allowPrivateIps ? fetch : unicastFetchWrap({ fetch }),
      ),

      /**
       * Since we will be fetching user owned data, we need to make sure that an
       * attacker cannot force us to download a large amounts of data.
       */
      fetchMaxSizeProcessor(responseMaxSize),
    ),
  )
}
