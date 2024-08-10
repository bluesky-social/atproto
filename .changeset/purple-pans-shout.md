---
"@atproto/lex-cli": minor
"@atproto/xrpc": minor
"@atproto/api": minor
"@atproto/dev-env": patch
"@atproto/lexicon": patch
"@atproto/ozone": patch
"@atproto/bsky": patch
"@atproto/pds": patch
"@atproto/xrpc-server": patch
---

## New Features

1) We've restructured the `XrpcClient` HTTP fetch handler to be specified during
   the instantiation of the XRPC client, through the constructor, instead of
   using a default - and statically defined - implementation.
2) With this refactor, the XRPC client is now more adaptable to various use
   cases. In particular, session management, retries, and other request-specific
   logic (signing, etc.) can be implemented in the fetch handler itself rather
   than by the calling code.
3) A new abstract class named `Agent`, has been added to `@atproto/api`. This
   class is the base class for all Bluesky agents classes in the `@atproto`
   ecosystem. It is meant to be extended by implementation that provide
   session management and fetch handling.

## Motivation

This change is motivated by the need to make the `@atproto/api` package more
flexible when it comes to session management. In particular, they are forward
compatible with the upcoming support of OAuth by atproto.

In addition to this, the redesigned session management system fixes a bug that
could cause the session data to become invalid when Agent clones are created
(e.g. using `agent.withProxy()`).

## Non-breaking changes

- The `com.*` and `app.*` namespaces have been made directly available
  to every `Agent` instances.

## Breaking changes

Most of the changes introduced in this version are backward-compatible. However,
there are a couple of breaking changes you should be aware of:

- Customizing `fetch`: The ability to customize the `fetch: FetchHandler`
  property of `@atproto/xrpc`'s `Client` and `@atproto/api`'s `AtpAgent` classes
  has been removed. Previously, the `fetch` property could be set to a function
  that would be used as the fetch handler for that instance, and was initialized
  to a default fetch handler. That property is still accessible in a read-only
  fashion through the `fetchHandler` property. That property can only be set
  during the instance creation. Attempting to set/get the `fetch` property will
  now result in an error.

- The `fetch()` method, as well as WhatWG compliant `Request` and `Headers`
  constructors, must be globally available in your environment. Use a polyfill
  if necessary.

- The `AtpBaseClient` has been removed. The `AtpServiceClient` has been renamed
  `AtpBaseClient`. Any code using either of these classes will need to be
  updated.

- Instead of *wrapping* an `XrpcClient` in its `xrpc` property, the
  `AtpBaseClient` (formerly `AtpServiceClient`) class, created through
  `lex-cli`, now *extends* the `XrpcClient` class. This means that a client
  instance now passes the `instanceof XrpcClient` check. The `xrpc` property now
  returns the instance itself and has been deprecated.

- `setSessionPersistHandler` is no longer available on the `AtpAgent` or
  `BskyAgent` classes. The session handler can only be set though the
  `persistSession` options of the `AtpAgent` constructor.

- The new class hierarchy is as follows:

  - `BskyAgent` extends `AtpAgent`: but add no functionality (hence its
    deprecation).
  - `AtpAgent` extends `Agent`: adds password based session management.
  - `Agent` extends `AtpClient`: this abstract class that adds syntactic sugar
    methods for the `com.atproto` and `app.bsky` lexicons. It also adds abstract
    session management methods.
  - `AtpClient` extends `AtpBaseClient` by adding atproto specific utilities
    (`labelers` & `proxy` headers, instance cloning)
  - `AtpBaseClient` extends `XrpcClient`: automatically code that adds fully
    typed lexicon defined namespaces (`instance.app.bsky.feed.getPosts()`) to
    the `XrpcClient`.
  - `XrpcClient` is the base class.

## Deprecations

- The default export of the `@atproto/xrpc` package has been deprecated. Use
  named exports instead.

- The `Client` and `ServiceClient` classes are now deprecated. They are replaced
  by a single `XrpcClient` class.

- The default export of the `@atproto/api` package has been deprecated. Use
  named exports instead.

- The `BskyAgent` has been deprecated. Use the `AtpAgent` class instead.

- The `xrpc` property of the `AtpClient` instances has been deprecated. The
  instance itself should be used as the XRPC client.

- The `api` property of the `AtpAgent` and `BskyAgent` instances has been
  deprecated. Use the instance itself instead.

## Migration

### The `@atproto/api` package

If you were relying on the `AtpBaseClient` class to perform validation solely, use this:


<table>
<tr>
<td><center>Before</center></td> <td><center>After</center></td>
</tr>
<tr>
<td>

```ts
import { AtpBaseClient, ComAtprotoSyncSubscribeRepos } from '@atproto/api'

const baseClient = new AtpBaseClient()

baseClient.xrpc.lex.assertValidXrpcMessage('io.example.doStuff', {
  // ...
})
```

</td>
<td>

```ts
import { schemas } from '@atproto/xrpc'
import { Lexicons } from '@atproto/lexicon'

const lexicons = new Lexicons(schemas)

lexicons.assertValidXrpcMessage('io.example.doStuff', {
  // ...
})
```

</td>
</tr>
</table>

If you are extending the `BskyAgent` to perform custom `session` manipulation, define your own `Agent` subclass instead:

<table>
<tr>
<td><center>Before</center></td> <td><center>After</center></td>
</tr>
<tr>
<td>

```ts
import { BskyAgent } from '@atproto/api'

class MyAgent extends BskyAgent {
  private accessToken?: string

  async createOrRefleshSession(identifier: string, password: string) {
    // custom logic here

    this.accessToken = 'my-access-jwt'
  }

  async doStuff() {
    return this.call('io.example.doStuff', {
      headers: {
        Authorization: this.accessToken && `Bearer ${this.accessToken}`
      }
    })
  }
}
```

</td>
<td>

```ts
import { Agent } from '@atproto/api'

class MyAgent extends Agent {
  private accessToken?: string

  constructor(service: string | URL) {
    super((url, init) => {
      const headers = new Headers(init.headers)

      // Add the Authorization header on every request
      if (this.accessToken) {
        headers.set('Authorization', `Bearer ${this.accessToken}`)
      }

      return fetch(new URL(url, service), { ...init, headers })
    })
  }

  async createOrRefleshSession(identifier: string, password: string) {
    // custom logic here

    this.accessToken = 'my-access-jwt'
  }
}
```

</td>
</tr>
</table>


If you are monkey patching the the `xrpc` service client to perform client-side rate limiting, you can now do this in the `FetchHandler` function:

<table>
<tr>
<td><center>Before</center></td> <td><center>After</center></td>
</tr>
<tr>
<td>

```ts
import { BskyAgent } from '@atproto/api'
import { RateLimitThreshold } from "rate-limit-threshold"

const agent = new BskyAgent()
const limiter = new RateLimitThreshold(
  3000,
  300_000
)

const origCall = agent.api.xrpc.call
agent.api.xrpc.call = async function (...args) {
  await limiter.wait()
  return origCall.call(this, ...args)
}

```

</td>
<td>

```ts
import { AtpAgent } from '@atproto/api'
import { RateLimitThreshold } from "rate-limit-threshold"

class LimitedAtpAgent extends AtpAgent {
  constructor(options: AtpAgentOptions) {
    const fetch = options.fetch ?? globalThis.fetch
    const limiter = new RateLimitThreshold(
      3000,
      300_000
    )

    super({
      ...options,
      fetch: async (...args) => {
        await limiter.wait()
        return fetch(...args)
      }
    })
  }
}
```

</td>
</tr>
</table>

If you configure a static `fetch` handler on the `BskyAgent` class, for example
to modify the headers of every request, you can now do this by providing your
own `fetch` function:


<table>
<tr>
<td><center>Before</center></td> <td><center>After</center></td>
</tr>
<tr>
<td>

```ts
import { BskyAgent, defaultFetchHandler } from '@atproto/api'

BskyAgent.configure({
  fetch: async (httpUri, httpMethod, httpHeaders, httpReqBody) => {

    const ua = httpHeaders["User-Agent"]

    httpHeaders["User-Agent"] = ua ? `${ua} ${userAgent}` : userAgent

    return defaultFetchHandler(httpUri, httpMethod, httpHeaders, httpReqBody)
  }
})
```

</td>
<td>

```ts
import { AtpAgent } from '@atproto/api'

class MyAtpAgent extends AtpAgent {
  constructor(options: AtpAgentOptions) {
    const fetch = options.fetch ?? globalThis.fetch

    super({
      ...options,
      fetch: async (url, init) => {
        const headers = new Headers(init.headers)

        const ua = headersList.get("User-Agent")
        headersList.set("User-Agent", ua ? `${ua} ${userAgent}` : userAgent)

        return fetch(url, { ...init, headers })
      }
    })
  }
}
```

</td>
</tr>
</table>


<!-- <table>
<tr>
<td><center>Before</center></td> <td><center>After</center></td>
</tr>
<tr>
<td>

```ts
// before
```

</td>
<td>

```ts
// after
```

</td>
</tr>
</table> -->


### The `@atproto/xrpc` package

The `Client` and `ServiceClient` classes are now **deprecated**. If you need a
lexicon based client, you should update the code to use the `XrpcClient` class
instead.

The deprecated `ServiceClient` class now extends the new `XrpcClient` class.
Because of this, the `fetch` `FetchHandler` can no longer be configured on the
`Client` instances (including the default export of the package). If you are not
relying on the `fetch` `FetchHandler`, the new changes should have no impact on
your code. Beware that the deprecated classes will eventually be removed in a
future version.

Because it's use was completely changed, the `FetchHandler` type was also
completely changed. The new `FetchHandler` type is now a function that receives
a `url` pathname and a `RequestInit` object and returns a `Promise<Response>`.
This function is responsible from making the actual request to the server.

```ts
export type FetchHandler = (
  this: void,
  /**
   * The URL (pathname + query parameters) to make the request to, without the
   * origin. The origin (protocol, hostname, and port) must be added by this
   * {@link FetchHandler}, typically based on authentication or other factors.
   */
  url: string,
  init: RequestInit,
) => Promise<Response>
```

A noticeable change that was introduced is that the `uri` field of the
`ServiceClient` class was _not_ ported to the new `XrpcClient` class. It is now
the responsibility of the `FetchHandler` to determine the full URL to make the
request to. Same goes for the `headers`, that should now be set through the
`FetchHandler` function.

If you _do_ rely on the legacy `Client.fetch` property to perform custom logic
upon request, you will need to migrate your code to use the new `XrpcClient`
class. The `XrpcClient` class has a similar API to the old `ServiceClient`
class, but with a few differences:

- The `Client` + `ServiceClient` duality was removed in favor of a single
  `XrpcClient` class. This means that:

  - There no longer exist a centralized lexicon registry. If you
    need a global lexicon registry, you can maintain one yourself using a
    `new Lexicons` (from `@atproto/lexicon`).

  - The `FetchHandler` is no longer a statically defined property of the
    `Client` class. Instead, it is passed as an argument to the `XrpcClient`
    constructor.

- The `XrpcClient` constructor now requires a `FetchHandler` function as the
  first argument, and an optional `Lexicon` instance as the second argument.

- The `setHeander` and `unsetHeader` methods were not ported to the new
  `XrpcClient` class. If you need to set or unset headers, you should do so in
  the `FetchHandler` function provided in the constructor arg.

<table>
<tr>
<td><center>Before</center></td> <td><center>After</center></td>
</tr>
<tr>
<td>

```ts
import client, { defaultFetchHandler } from '@atproto/xrpc'

client.fetch = function (
  httpUri: string,
  httpMethod: string,
  httpHeaders: Headers,
  httpReqBody: unknown,
) {
  // Custom logic here
  return defaultFetchHandler(httpUri, httpMethod, httpHeaders, httpReqBody)
}

client.addLexicon({
  lexicon: 1,
  id: 'io.example.doStuff',
  defs: {},
})

const instance = client.service('http://my-service.com')

instance.setHeader('my-header', 'my-value')

await instance.call('io.example.doStuff')
```

</td>
<td>

```ts
import { XrpcClient } from '@atproto/xrpc'

const instance = new XrpcClient(
  async (url, init) => {
    const headers = new Headers(init.headers)

    headers.set('my-header', 'my-value')

    // Custom logic here

    const fullUrl = new URL(url, 'http://my-service.com')

    return fetch(fullUrl, { ...init, headers })
  },
  [
    {
      lexicon: 1,
      id: 'io.example.doStuff',
      defs: {},
    },
  ],
)

await instance.call('io.example.doStuff')
```

</td>
</tr>
</table>

If your fetch handler does not require any "custom logic", and all you need is
an `XrpcClient` that makes its HTTP requests towards a static service URL the
previous example can be simplified to:

```ts
import { XrpcClient } from '@atproto/xrpc'

const instance = new XrpcClient('http://my-service.com', [
  {
    lexicon: 1,
    id: 'io.example.doStuff',
    defs: {},
  },
])
```

If you need to add static headers to all requests, you can instead instantiate
the `XrpcClient` as follows:

```ts
import { XrpcClient } from '@atproto/xrpc'

const instance = new XrpcClient(
  {
    service: 'http://my-service.com',
    headers: {
      'my-header': 'my-value',
    },
  },
  [
    {
      lexicon: 1,
      id: 'io.example.doStuff',
      defs: {},
    },
  ],
)
```

If you need the headers - or service url - to be dynamic, you can define them
using (async) functions:

```ts
import { XrpcClient } from '@atproto/xrpc'

const instance = new XrpcClient(
  {
    service: () => 'http://my-service.com',
    headers: {
      'my-header': () => 'my-value',
      'my-ignored-header': async () => null, // ignored
    },
  },
  [
    {
      lexicon: 1,
      id: 'io.example.doStuff',
      defs: {},
    },
  ],
)
```
