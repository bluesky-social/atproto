import {
  Fetch,
  fetchMaxSizeProcessor,
  forbiddenDomainNameRequestTransform,
  protocolCheckRequestTransform,
} from '@atproto/fetch'
import { compose } from '@atproto/transformer'

import { ssrfSafeHostname } from './ssrf.js'

export type SafeFetchWrapOptions = NonNullable<
  Parameters<typeof safeFetchWrap>[0]
>
export const safeFetchWrap = ({
  fetch = globalThis.fetch as Fetch,
  responseMaxSize = 512 * 1024, // 512kB
  allowHttp = false,
  ssrfProtection = true,
  forbiddenDomainNames = [
    'example.com',
    'example.org',
    'example.net',
    'bsky.social',
    'bsky.network',
    'googleusercontent.com',
  ] as Iterable<string>,
} = {}): Fetch =>
  compose(
    /**
     * Prevent using http:, file: or data: protocols.
     */
    protocolCheckRequestTransform(allowHttp ? ['http:', 'https:'] : ['https:']),

    /**
     * Disallow fetching from domains we know are not atproto/OIDC client
     * implementation. Note that other domains can be blocked by providing a
     * custom fetch function combined with another
     * forbiddenDomainNameRequestTransform.
     */
    forbiddenDomainNameRequestTransform(forbiddenDomainNames),

    /**
     * Since we will be fetching from the network based on user provided
     * input, we need to make sure that the request is not vulnerable to SSRF
     * attacks.
     */
    ssrfProtection ? ssrfSafeFetchWrap({ fetch }) : fetch,

    /**
     * Since we will be fetching user owned data, we need to make sure that an
     * attacker cannot force us to download a large amounts of data.
     */
    fetchMaxSizeProcessor(responseMaxSize),
  )

export type SsrfSafeFetchWrapOptions = NonNullable<
  Parameters<typeof ssrfSafeFetchWrap>[0]
>
export const ssrfSafeFetchWrap = ({
  fetch = globalThis.fetch as Fetch,
} = {}): Fetch => {
  const ssrfSafeFetch: Fetch = async (request) => {
    const { hostname } = new URL(request.url)

    // Make sure the hostname is a valid IP address
    const ip = await ssrfSafeHostname(hostname)
    if (ip) {
      // Normally we would replace the hostname with the IP address and set the
      // Host header to the original hostname. However, since we are using
      // fetch() we can't set the Host header.
    }

    if (request.redirect === 'follow') {
      // TODO: actually implement by calling ssrfSafeFetch recursively
      throw new Error(
        'Request redirect must be "error" or "manual" when SSRF is enabled',
      )
    }

    return fetch(request)
  }

  return ssrfSafeFetch
}
