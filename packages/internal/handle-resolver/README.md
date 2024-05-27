# Universal Handle Resolver implementation for ATPROTO

This package provides a handle resolver implementation for ATPROTO. It is used
to resolve handles to their corresponding DID.

This package is meant to be used in any JavaScript environment that support the
`fetch()` function. Because APTORO handle resolution requires DNS resolution,
you will need to provide your own DNS resolution function when using this
package.

There are two main classes in this package:

- `AtprotoHandleResolver` This implements the official ATPROTO handle resolution
  algorithm (and requires a DNS resolver).
- `AppViewHandleResolver` This uses HTTP requests to the Bluesky AppView
  (bsky.app) to provide handle resolution.

## Usage

### From a front-end app

Since the ATPROTO handle resolution algorithm requires DNS resolution, and the
browser does not provide a built-in DNS resolver, this package offers two
options:

- Delegate handle resolution to an AppView (`AppViewHandleResolver`). This is
  the recommended approach for front-end apps.
- Use a DNS-over-HTTPS (DoH) server (`DohHandleResolver`). Prefer this method
  if you don't own an AppView and already have a DoH server that you trust.

Using an AppView:

> [!CAUTION]
> Use the Bluesky owned AppView (`https://api.bsky.app/`), or PDS
> (`https://bsky.social/`), at your own risk. Using these servers in a
> third-party application might expose your users' data (IP address) to Bluesky.
> Bluesky might log the data sent to it when your app is resolving handles.
> Bluesky might also change the API, or terms or use, at any time without
> notice. Make sure you are compliant with the Bluesky terms of use as well as
> any laws and regulations that apply to your use case.

```ts
import { AppViewHandleResolver } from '@atproto-labs/handle-resolver'

const resolver = new AppViewHandleResolver({
  service: 'https://my-app-view.com/',
})
const did = await resolver.resolve('my-handle.bsky.social')
```

Using DNS-over-HTTPS (DoH) for DNS resolution:

> [!CAUTION]
> Using a DoH server that you don't own might expose your users' data to
> the DoH server provider. The DoH server provider might log the data sent to it
> by your app, allowing them to track which handles are being resolved by your
> users. In the browser, it is recommended to use a DoH server that you own and
> control. Or to implement your own AppView and use the `AppViewHandleResolver`
> class.

> [!NOTE]
> Using the `DohHandleResolver` requires a DNS-over-HTTPS server that
> supports the DNS-over-HTTPS protocol with "application/dns-json" responses.

```ts
import { DohHandleResolver } from '@atproto-labs/handle-resolver'

// Also works with 'https://cloudflare-dns.com/dns-query'
const resolver = new DohHandleResolver('https://dns.google/resolve', {
  // Optional: Custom fetch function that will be used both for DNS resolution
  // and well-known resolution.
  fetch: globalThis.fetch.bind(globalThis),
})

const did = await resolver.resolve('my-handle.bsky.social')
```

### From a Node.js app

> [!NOTE]
> On a Node.js backend, you will probably want to use the
> "@atproto-labs/handle-resolver-node" package. The example below applies to
> Node.js code running on a user's machine (e.g. through Electron).

```ts
import { AtprotoHandleResolver } from '@atproto-labs/handle-resolver'
import { resolveTxt } from 'node:dns/promises'

const resolver = new AtprotoHandleResolver({
  // Optional: Custom fetch function (used for well-known resolution)
  fetch: globalThis.fetch.bind(globalThis),

  resolveTxt: async (domain: string) =>
    resolveTxt(domain).then((chunks) => chunks.join('')),
})
```

### Caching

Using a default, in-memory cache, in which items expire after 10 minutes:

```ts
import {
  AppViewHandleResolver,
  CachedHandleResolver,
  HandleResolver,
  HandleCache,
} from '@atproto-labs/handle-resolver'

// See previous examples for creating a resolver
declare const sourceResolver: HandleResolver

const resolver = new CachedHandleResolver(sourceResolver)
const did = await resolver.resolve('my-handle.bsky.social')
const did = await resolver.resolve('my-handle.bsky.social') // Result from cache
const did = await resolver.resolve('my-handle.bsky.social') // Result from cache
```

Using a custom cache:

```ts
import {
  AppViewHandleResolver,
  CachedHandleResolver,
  HandleResolver,
  HandleCache,
} from '@atproto-labs/handle-resolver'

// See previous examples for creating a resolver
declare const sourceResolver: HandleResolver

const cache: HandleCache = {
  set(handle, did): Promise<void> {
    /* TODO */
  },
  get(handle): Promise<undefined | string> {
    /* TODO */
  },
  del(handle): Promise<void> {
    /* TODO */
  },
}

const resolver = new CachedHandleResolver(sourceResolver, cache)
const did = await resolver.resolve('my-handle.bsky.social')
const did = await resolver.resolve('my-handle.bsky.social') // Result from cache
const did = await resolver.resolve('my-handle.bsky.social') // Result from cache
```
