import {
  Fetch,
  fetchMaxSizeProcessor,
  forbiddenDomainNameRequestTransform,
  protocolCheckRequestTransform,
} from '@atproto/fetch'
import { compose } from '@atproto/transformer'

import { ssrfFetchWrap } from './ssrf.js'

export type SafeFetchWrapOptions = NonNullable<
  Parameters<typeof safeFetchWrap>[0]
>

/**
 * Wrap a fetch function with safety checks so that it can be safely used
 * with user provided input (URL).
 */
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
    ssrfProtection ? ssrfFetchWrap({ fetch }) : fetch,

    /**
     * Since we will be fetching user owned data, we need to make sure that an
     * attacker cannot force us to download a large amounts of data.
     */
    fetchMaxSizeProcessor(responseMaxSize),
  )
