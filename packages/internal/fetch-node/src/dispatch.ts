import type { LookupFunction } from 'node:net'
import { Agent as Undici6Agent } from 'undici_v6' // NodeJS 22
import { Agent as Undici7Agent } from 'undici_v7' // NodeJS 24
import { Agent as Undici8Agent } from 'undici_v8' // NodeJS 26
import {
  type Fetch,
  type FetchContext,
  FetchRequestError,
  type UrlPolicyReason,
  asRequest,
} from '@atproto-labs/fetch'
import { compareVersions, parseVersion } from './util.js'

export type UrlCheck = (url: URL) => UrlPolicyReason | undefined

/**
 * The undici 6/7/8 `Agent` classes are structurally incompatible as a union, so
 * dispatch composition is expressed against this narrow view of them. Only the
 * fields the guard actually reads are described.
 */
type DispatchOptions = {
  origin: string | URL
}
type Dispatch = (opts: DispatchOptions, handler: unknown) => boolean
type DispatchInterceptor = (dispatch: Dispatch) => Dispatch
type ComposableAgent = {
  compose?: (interceptor: DispatchInterceptor) => unknown
}

export type SafeDispatchFetchWrapOptions<C = FetchContext> = {
  fetch?: Fetch<C>

  /**
   * Invoked for **every** request issued through the returned fetch, including
   * every redirect hop, before a connection is attempted.
   *
   * This is the only place a redirect hop can be vetoed: `fetch()` follows
   * redirects internally, above the dispatcher, so request-level transforms
   * only ever observe the initial url.
   *
   * @note The {@link URL} it receives carries the dispatched **origin** only —
   * its path and query are always empty. The dispatcher cannot report them
   * soundly (see {@link urlCheckInterceptor}), so a policy must not depend on
   * them.
   */
  checkUrl?: UrlCheck

  /**
   * Connect-time DNS guard. Catches hostnames that *resolve* to a forbidden
   * address, which {@link checkUrl} cannot see. Note that NodeJS does not
   * resolve literal-IP hosts, so this is never called for them — those must be
   * caught by {@link checkUrl}.
   */
  lookup?: LookupFunction
}

/**
 * Wraps a fetch function so that every request it issues — including every
 * redirect hop — is dispatched through a guarded undici Agent.
 */
export function safeDispatchFetchWrap<C = FetchContext>({
  fetch = globalThis.fetch,
  checkUrl,
  lookup,
}: SafeDispatchFetchWrapOptions<C> = {}): Fetch<C> {
  const dispatcher = buildDispatcher({ checkUrl, lookup })

  return async function (this: C, input, init): Promise<Response> {
    if (init != null && 'dispatcher' in init && init.dispatcher != null) {
      const request = asRequest(input, init)
      await request.body?.cancel()
      const cause = new FetchRequestError(
        request,
        500,
        'SSRF protection cannot be used with a custom request dispatcher',
      )
      // @NOTE Use Whatwg style errors so that the error is similar whether
      // caused by this line of an error caused by the lookup function
      throw new TypeError('fetch failed', { cause })
    }

    return fetch.call(this, input, {
      ...init,
      // @ts-ignore There is a type mismatch because of undici version
      // differences, but we know this is safe because we are using the correct
      // Agent class for the undici version.
      dispatcher,
    })
  }
}

function buildDispatcher({ checkUrl, lookup }: SafeDispatchFetchWrapOptions) {
  // @NOTE we parse here instead of top-level to allow version mocking in tests.
  const nodeUndiciVersion = parseVersion(process.versions.undici)

  if (
    !nodeUndiciVersion ||
    // https://github.com/nodejs/undici/pull/2928
    compareVersions(nodeUndiciVersion, [6, 11, 1]) < 0
  ) {
    throw new Error('Unicast SSRF protection requires Node.js 20.6+')
  }

  const connect = lookup ? { lookup } : undefined

  // @NOTE Since major versions of undici are not guaranteed to be backwards
  // compatible, we need to check the major version and use the appropriate
  // Agent class for that version, to ensure that the dispatcher interface is
  // compatible with the version of undici being used.
  const agent =
    nodeUndiciVersion[0] === 6
      ? new Undici6Agent({ connect })
      : nodeUndiciVersion[0] === 7
        ? new Undici7Agent({ connect })
        : nodeUndiciVersion[0] === 8
          ? new Undici8Agent({ connect })
          : null

  // @NOTE Because this is a security feature, we don't want to fallback to
  // using Agent8 to "future proof" this package. Although future version of
  // undici may have a backwards compatible dispatcher interface, we don't want
  // to assume that and risk a security issue.
  if (!agent) {
    throw new Error(
      'This version of @atproto-labs/fetch-node does not support your version of undici. Please upgrade @atproto-labs/fetch-node, and use a version of NodeJS that uses undici 6, 7, or 8 internally.',
    )
  }

  if (!checkUrl) return agent

  const composable = agent as unknown as ComposableAgent

  // @NOTE Feature-detected rather than gated on a version number: `compose()`
  // landed partway through the undici 6.x line, and guessing the exact release
  // would risk either rejecting a capable runtime or, worse, silently skipping
  // the redirect hop checks on an incapable one. Fail loudly instead.
  if (typeof composable.compose !== 'function') {
    throw new Error(
      `The undici version bundled with this NodeJS release (${process.versions.undici}) does not support dispatcher interceptors, which are required to validate redirect hops. Please upgrade NodeJS.`,
    )
  }

  return composable.compose(urlCheckInterceptor(checkUrl))
}

/**
 * Vetoes a dispatch whose url violates the policy, before any connection is
 * made. Because `fetch()` re-dispatches through the same dispatcher for each
 * redirect hop, this observes the whole chain.
 */
function urlCheckInterceptor(checkUrl: UrlCheck): DispatchInterceptor {
  return (dispatch) => (opts, handler) => {
    // @NOTE The origin alone, never resolved against `opts.path`. Every check
    // in the policy judges origin-level properties, so the path adds nothing
    // — and letting it participate is unsound: a pathname beginning with `//`
    // is protocol-relative, so `new URL(path, origin)` discards the origin and
    // yields a url describing the *path's* host rather than the host that is
    // about to be dialed.
    const url = new URL(String(opts.origin))

    const reason = checkUrl(url)
    if (reason) {
      // @NOTE The origin, not the full url, in the message: paths and query
      // strings may carry tokens that should not reach a log.
      //
      // @NOTE A plain Error rather than a FetchError: the caller's Request is
      // not available at this layer, and `fetch()` wraps whatever is thrown
      // here in `TypeError: fetch failed` regardless. Because the cause
      // carries no status code, consumers resolve it to a non-exposed 500, so
      // the reason stays available for logs without reaching a downstream
      // client.
      throw new Error(`Blocked by url policy (${url.origin}): ${reason}`)
    }

    return dispatch(opts, handler)
  }
}
