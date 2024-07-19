import {
  DnsHandleResolver,
  ResolveTxt,
} from './internal-resolvers/dns-handle-resolver.js'
import {
  WellKnownHandleResolver,
  WellKnownHandleResolverOptions,
} from './internal-resolvers/well-known-handler-resolver.js'
import {
  HandleResolver,
  ResolveHandleOptions,
  ResolvedHandle,
} from './types.js'

export type { ResolveTxt }
export type AtprotoHandleResolverOptions = WellKnownHandleResolverOptions & {
  resolveTxt: ResolveTxt
  resolveTxtFallback?: ResolveTxt
}

const noop = () => {}

/**
 * Implementation of the official ATPROTO handle resolution strategy.
 * This implementation relies on two primitives:
 * - HTTP Well-Known URI resolution (requires a `fetch()` implementation)
 * - DNS TXT record resolution (requires a `resolveTxt()` function)
 */
export class AtprotoHandleResolver implements HandleResolver {
  private readonly httpResolver: HandleResolver
  private readonly dnsResolver: HandleResolver
  private readonly dnsResolverFallback?: HandleResolver

  constructor(options: AtprotoHandleResolverOptions) {
    this.httpResolver = new WellKnownHandleResolver(options)
    this.dnsResolver = new DnsHandleResolver(options.resolveTxt)
    this.dnsResolverFallback = options.resolveTxtFallback
      ? new DnsHandleResolver(options.resolveTxtFallback)
      : undefined
  }

  async resolve(
    handle: string,
    options?: ResolveHandleOptions,
  ): Promise<ResolvedHandle> {
    options?.signal?.throwIfAborted()

    const abortController = new AbortController()
    const { signal } = abortController
    options?.signal?.addEventListener('abort', () => abortController.abort(), {
      signal,
    })

    const wrappedOptions = { ...options, signal }

    try {
      const dnsPromise = this.dnsResolver.resolve(handle, wrappedOptions)
      const httpPromise = this.httpResolver.resolve(handle, wrappedOptions)

      // Prevent uncaught promise rejection
      httpPromise.catch(noop)

      const dnsRes = await dnsPromise
      if (dnsRes) return dnsRes

      signal.throwIfAborted()

      const res = await httpPromise
      if (res) return res

      signal.throwIfAborted()

      return this.dnsResolverFallback?.resolve(handle, wrappedOptions) ?? null
    } finally {
      // Cancel pending requests, and remove "abort" listener on incoming signal
      abortController.abort()
    }
  }
}
