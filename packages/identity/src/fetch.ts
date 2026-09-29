import { type Fetch, safeFetchWrap } from '@atproto-labs/fetch-node'

/**
 * The fetch used by every resolver in this package when none is supplied.
 *
 * Callers that need to opt out of SSRF protection pass their own `fetch`
 * instead — `globalThis.fetch` in tests and dev-mode branches, or an
 * already-audited safe fetch such as the PDS's.
 */
export function createDefaultFetch(): Fetch {
  return safeFetchWrap({
    // Reject IP-literal hosts: did:web:1.2.3.4, or a handle at a bare IP.
    allowIpHost: false,

    // Every call site in this package passes `redirect` explicitly, so a call
    // site that forgets should fail loudly rather than silently follow.
    allowImplicitRedirect: false,

    // The rest of the protection is inherited from safeFetchWrap's
    // `ssrfProtection`-on defaults, each of which resolves to false here:
    //
    // - `allowHttp` is what refuses `did:web:localhost` — not `allowIpHost`
    //   above — and `web-resolver.ts`'s retained `localhost` → `http:`
    //   inference depends on it being the thing that blocks.
    // - `allowPrivateIps` installs the connect-time `unicastLookup` check,
    //   which catches a public-looking host that resolves to a private
    //   address.
    // - `allowCustomPort` refuses `did:web:example.com%3A3000`. Ports are a
    //   localhost testing affordance, and that already needs an injected fetch
    //   for `http:`.
    // - `forbiddenDomainNames` refuses hosts under example.com/.org/.net and
    //   googleusercontent.com.
    //
    // `timeout` (10s) and `responseMaxSize` (512kB) are inherited too; the 10s
    // is only a backstop, since the authoritative per-attempt bound is the
    // resolver's own `timeout`.
  })
}
