# @atproto/xrpc

## 0.6.4

### Patch Changes

- Updated dependencies [[`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d)]:
  - @atproto/lexicon@0.4.3

## 0.6.3

### Patch Changes

- [#2770](https://github.com/bluesky-social/atproto/pull/2770) [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add NotAcceptable response type

- Updated dependencies [[`87a1f2426`](https://github.com/bluesky-social/atproto/commit/87a1f24262e0e644b6cf31cc7a0446d9127ffa94)]:
  - @atproto/lexicon@0.4.2

## 0.6.2

### Patch Changes

- [#2464](https://github.com/bluesky-social/atproto/pull/2464) [`98711a147`](https://github.com/bluesky-social/atproto/commit/98711a147a8674337f605c6368f39fc10c2fae93) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add UnsupportedMediaType response type

## 0.6.1

### Patch Changes

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve handling of fetchHandler errors when turning them into `XrpcError`.

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add ability to instantiate XrpcClient from FetchHandlerObject type

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add global headers to `XrpcClient` instances

## 0.6.0

### Minor Changes

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)!

  #### Motivation

  The motivation for these changes is the need to make the `@atproto/api` package
  compatible with OAuth session management. We don't have OAuth client support
  "launched" and documented quite yet, so you can keep using the current app
  password authentication system. When we do "launch" OAuth support and begin
  encouraging its usage in the near future (see the [OAuth
  Roadmap](https://github.com/bluesky-social/atproto/discussions/2656)), these
  changes will make it easier to migrate.

  In addition, the redesigned session management system fixes a bug that could
  cause the session data to become invalid when Agent clones are created (e.g.
  using `agent.withProxy()`).

  #### New Features

  We've restructured the `XrpcClient` HTTP fetch handler to be specified during
  the instantiation of the XRPC client, through the constructor, instead of using
  a default implementation (which was statically defined).

  With this refactor, the XRPC client is now more modular and reusable. Session
  management, retries, cryptographic signing, and other request-specific logic can
  be implemented in the fetch handler itself rather than by the calling code.

  A new abstract class named `Agent`, has been added to `@atproto/api`. This class
  will be the base class for all Bluesky agents classes in the `@atproto`
  ecosystem. It is meant to be extended by implementations that provide session
  management and fetch handling.

  As you adapt your code to these changes, make sure to use the `Agent` type
  wherever you expect to receive an agent, and use the `AtpAgent` type (class)
  only to instantiate your client. The reason for this is to be forward compatible
  with the OAuth agent implementation that will also extend `Agent`, and not
  `AtpAgent`.

  ```ts
  import { Agent, AtpAgent } from "@atproto/api";

  async function setupAgent(
    service: string,
    username: string,
    password: string,
  ): Promise<Agent> {
    const agent = new AtpAgent({
      service,
      persistSession: (evt, session) => {
        // handle session update
      },
    });

    await agent.login(username, password);

    return agent;
  }
  ```

  ```ts
  import { Agent } from "@atproto/api";

  async function doStuffWithAgent(agent: Agent, arg: string) {
    return agent.resolveHandle(arg);
  }
  ```

  ```ts
  import { Agent, AtpAgent } from "@atproto/api";

  class MyClass {
    agent: Agent;

    constructor() {
      this.agent = new AtpAgent();
    }
  }
  ```

  #### Breaking changes

  Most of the changes introduced in this version are backward-compatible. However,
  there are a couple of breaking changes you should be aware of:

  - Customizing `fetch`: The ability to customize the `fetch: FetchHandler`
    property of `@atproto/xrpc`'s `Client` and `@atproto/api`'s `AtpAgent` classes
    has been removed. Previously, the `fetch` property could be set to a function
    that would be used as the fetch handler for that instance, and was initialized
    to a default fetch handler. That property is still accessible in a read-only
    fashion through the `fetchHandler` property and can only be set during the
    instance creation. Attempting to set/get the `fetch` property will now result
    in an error.
  - The `fetch()` method, as well as WhatWG compliant `Request` and `Headers`
    constructors, must be globally available in your environment. Use a polyfill
    if necessary.
  - The `AtpBaseClient` has been removed. The `AtpServiceClient` has been renamed
    `AtpBaseClient`. Any code using either of these classes will need to be
    updated.
  - Instead of _wrapping_ an `XrpcClient` in its `xrpc` property, the
    `AtpBaseClient` (formerly `AtpServiceClient`) class - created through
    `lex-cli` - now _extends_ the `XrpcClient` class. This means that a client
    instance now passes the `instanceof XrpcClient` check. The `xrpc` property now
    returns the instance itself and has been deprecated.
  - `setSessionPersistHandler` is no longer available on the `AtpAgent` or
    `BskyAgent` classes. The session handler can only be set though the
    `persistSession` options of the `AtpAgent` constructor.
  - The new class hierarchy is as follows:
    - `BskyAgent` extends `AtpAgent`: but add no functionality (hence its
      deprecation).
    - `AtpAgent` extends `Agent`: adds password based session management.
    - `Agent` extends `AtpBaseClient`: this abstract class that adds syntactic sugar
      methods `app.bsky` lexicons. It also adds abstract session management
      methods and adds atproto specific utilities
      (`labelers` & `proxy` headers, cloning capability)
    - `AtpBaseClient` extends `XrpcClient`: automatically code that adds fully
      typed lexicon defined namespaces (`instance.app.bsky.feed.getPosts()`) to
      the `XrpcClient`.
    - `XrpcClient` is the base class.

  #### Non-breaking changes

  - The `com.*` and `app.*` namespaces have been made directly available to every
    `Agent` instances.

  #### Deprecations

  - The default export of the `@atproto/xrpc` package has been deprecated. Use
    named exports instead.
  - The `Client` and `ServiceClient` classes are now deprecated. They are replaced by a single `XrpcClient` class.
  - The default export of the `@atproto/api` package has been deprecated. Use
    named exports instead.
  - The `BskyAgent` has been deprecated. Use the `AtpAgent` class instead.
  - The `xrpc` property of the `AtpClient` instances has been deprecated. The
    instance itself should be used as the XRPC client.
  - The `api` property of the `AtpAgent` and `BskyAgent` instances has been
    deprecated. Use the instance itself instead.

  #### Migration

  ##### The `@atproto/api` package

  If you were relying on the `AtpBaseClient` solely to perform validation, use
  this:

  <table>
  <tr>
  <td><center>Before</center></td> <td><center>After</center></td>
  </tr>
  <tr>
  <td>

  ```ts
  import { AtpBaseClient, ComAtprotoSyncSubscribeRepos } from "@atproto/api";

  const baseClient = new AtpBaseClient();

  baseClient.xrpc.lex.assertValidXrpcMessage("io.example.doStuff", {
    // ...
  });
  ```

  </td>
  <td>

  ```ts
  import { lexicons } from "@atproto/api";

  lexicons.assertValidXrpcMessage("io.example.doStuff", {
    // ...
  });
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
  import { BskyAgent } from "@atproto/api";

  class MyAgent extends BskyAgent {
    private accessToken?: string;

    async createOrRefreshSession(identifier: string, password: string) {
      // custom logic here

      this.accessToken = "my-access-jwt";
    }

    async doStuff() {
      return this.call("io.example.doStuff", {
        headers: {
          Authorization: this.accessToken && `Bearer ${this.accessToken}`,
        },
      });
    }
  }
  ```

  </td>
  <td>

  ```ts
  import { Agent } from "@atproto/api";

  class MyAgent extends Agent {
    private accessToken?: string;
    public did?: string;

    constructor(private readonly service: string | URL) {
      super({
        service,
        headers: {
          Authorization: () =>
            this.accessToken ? `Bearer ${this.accessToken}` : null,
        },
      });
    }

    clone(): MyAgent {
      const agent = new MyAgent(this.service);
      agent.accessToken = this.accessToken;
      agent.did = this.did;
      return this.copyInto(agent);
    }

    async createOrRefreshSession(identifier: string, password: string) {
      // custom logic here

      this.did = "did:example:123";
      this.accessToken = "my-access-jwt";
    }
  }
  ```

  </td>
  </tr>
  </table>

  If you are monkey patching the `xrpc` service client to perform client-side rate limiting, you can now do this in the `FetchHandler` function:

  <table>
  <tr>
  <td><center>Before</center></td> <td><center>After</center></td>
  </tr>
  <tr>
  <td>

  ```ts
  import { BskyAgent } from "@atproto/api";
  import { RateLimitThreshold } from "rate-limit-threshold";

  const agent = new BskyAgent();
  const limiter = new RateLimitThreshold(3000, 300_000);

  const origCall = agent.api.xrpc.call;
  agent.api.xrpc.call = async function (...args) {
    await limiter.wait();
    return origCall.call(this, ...args);
  };
  ```

  </td>
  <td>

  ```ts
  import { AtpAgent } from "@atproto/api";
  import { RateLimitThreshold } from "rate-limit-threshold";

  class LimitedAtpAgent extends AtpAgent {
    constructor(options: AtpAgentOptions) {
      const fetch: typeof globalThis.fetch = options.fetch ?? globalThis.fetch;
      const limiter = new RateLimitThreshold(3000, 300_000);

      super({
        ...options,
        fetch: async (...args) => {
          await limiter.wait();
          return fetch(...args);
        },
      });
    }
  }
  ```

  </td>
  </tr>
  </table>

  If you configure a static `fetch` handler on the `BskyAgent` class - for example
  to modify the headers of every request - you can now do this by providing your
  own `fetch` function:

  <table>
  <tr>
  <td><center>Before</center></td> <td><center>After</center></td>
  </tr>
  <tr>
  <td>

  ```ts
  import { BskyAgent, defaultFetchHandler } from "@atproto/api";

  BskyAgent.configure({
    fetch: async (httpUri, httpMethod, httpHeaders, httpReqBody) => {
      const ua = httpHeaders["User-Agent"];

      httpHeaders["User-Agent"] = ua ? `${ua} ${userAgent}` : userAgent;

      return defaultFetchHandler(httpUri, httpMethod, httpHeaders, httpReqBody);
    },
  });
  ```

  </td>
  <td>

  ```ts
  import { AtpAgent } from "@atproto/api";

  class MyAtpAgent extends AtpAgent {
    constructor(options: AtpAgentOptions) {
      const fetch = options.fetch ?? globalThis.fetch;

      super({
        ...options,
        fetch: async (url, init) => {
          const headers = new Headers(init.headers);

          const ua = headersList.get("User-Agent");
          headersList.set("User-Agent", ua ? `${ua} ${userAgent}` : userAgent);

          return fetch(url, { ...init, headers });
        },
      });
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

  ##### The `@atproto/xrpc` package

  The `Client` and `ServiceClient` classes are now **deprecated**. If you need a
  lexicon based client, you should update the code to use the `XrpcClient` class
  instead.

  The deprecated `ServiceClient` class now extends the new `XrpcClient` class.
  Because of this, the `fetch` `FetchHandler` can no longer be configured on the
  `Client` instances (including the default export of the package). If you are not
  relying on the `fetch` `FetchHandler`, the new changes should have no impact on
  your code. Beware that the deprecated classes will eventually be removed in a
  future version.

  Since its use has completely changed, the `FetchHandler` type has also
  completely changed. The new `FetchHandler` type is now a function that receives
  a `url` pathname and a `RequestInit` object and returns a `Promise<Response>`.
  This function is responsible for making the actual request to the server.

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
  ) => Promise<Response>;
  ```

  A noticeable change that has been introduced is that the `uri` field of the
  `ServiceClient` class has _not_ been ported to the new `XrpcClient` class. It is
  now the responsibility of the `FetchHandler` to determine the full URL to make
  the request to. The same goes for the `headers`, which should now be set through
  the `FetchHandler` function.

  If you _do_ rely on the legacy `Client.fetch` property to perform custom logic
  upon request, you will need to migrate your code to use the new `XrpcClient`
  class. The `XrpcClient` class has a similar API to the old `ServiceClient`
  class, but with a few differences:

  - The `Client` + `ServiceClient` duality was removed in favor of a single
    `XrpcClient` class. This means that:

    - There no longer exists a centralized lexicon registry. If you need a global
      lexicon registry, you can maintain one yourself using a `new Lexicons` (from
      `@atproto/lexicon`).
    - The `FetchHandler` is no longer a statically defined property of the
      `Client` class. Instead, it is passed as an argument to the `XrpcClient`
      constructor.

  - The `XrpcClient` constructor now requires a `FetchHandler` function as the
    first argument, and an optional `Lexicon` instance as the second argument.
  - The `setHeader` and `unsetHeader` methods were not ported to the new
    `XrpcClient` class. If you need to set or unset headers, you should do so in
    the `FetchHandler` function provided in the constructor arg.

  <table>
  <tr>
  <td><center>Before</center></td> <td><center>After</center></td>
  </tr>
  <tr>
  <td>

  ```ts
  import client, { defaultFetchHandler } from "@atproto/xrpc";

  client.fetch = function (
    httpUri: string,
    httpMethod: string,
    httpHeaders: Headers,
    httpReqBody: unknown,
  ) {
    // Custom logic here
    return defaultFetchHandler(httpUri, httpMethod, httpHeaders, httpReqBody);
  };

  client.addLexicon({
    lexicon: 1,
    id: "io.example.doStuff",
    defs: {},
  });

  const instance = client.service("http://my-service.com");

  instance.setHeader("my-header", "my-value");

  await instance.call("io.example.doStuff");
  ```

  </td>
  <td>

  ```ts
  import { XrpcClient } from "@atproto/xrpc";

  const instance = new XrpcClient(
    async (url, init) => {
      const headers = new Headers(init.headers);

      headers.set("my-header", "my-value");

      // Custom logic here

      const fullUrl = new URL(url, "http://my-service.com");

      return fetch(fullUrl, { ...init, headers });
    },
    [
      {
        lexicon: 1,
        id: "io.example.doStuff",
        defs: {},
      },
    ],
  );

  await instance.call("io.example.doStuff");
  ```

  </td>
  </tr>
  </table>

  If your fetch handler does not require any "custom logic", and all you need is
  an `XrpcClient` that makes its HTTP requests towards a static service URL, the
  previous example can be simplified to:

  ```ts
  import { XrpcClient } from "@atproto/xrpc";

  const instance = new XrpcClient("http://my-service.com", [
    {
      lexicon: 1,
      id: "io.example.doStuff",
      defs: {},
    },
  ]);
  ```

  If you need to add static headers to all requests, you can instead instantiate
  the `XrpcClient` as follows:

  ```ts
  import { XrpcClient } from "@atproto/xrpc";

  const instance = new XrpcClient(
    {
      service: "http://my-service.com",
      headers: {
        "my-header": "my-value",
      },
    },
    [
      {
        lexicon: 1,
        id: "io.example.doStuff",
        defs: {},
      },
    ],
  );
  ```

  If you need the headers or service url to be dynamic, you can define them using
  functions:

  ```ts
  import { XrpcClient } from "@atproto/xrpc";

  const instance = new XrpcClient(
    {
      service: () => "http://my-service.com",
      headers: {
        "my-header": () => "my-value",
        "my-ignored-header": () => null, // ignored
      },
    },
    [
      {
        lexicon: 1,
        id: "io.example.doStuff",
        defs: {},
      },
    ],
  );
  ```

- [#2483](https://github.com/bluesky-social/atproto/pull/2483) [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add the ability to use `fetch()` compatible `BodyInit` body when making XRPC calls.

### Patch Changes

- Updated dependencies [[`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`2bdf75d7a`](https://github.com/bluesky-social/atproto/commit/2bdf75d7a63924c10e7a311f16cb447d595b933e)]:
  - @atproto/lexicon@0.4.1

## 0.5.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

### Patch Changes

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/lexicon@0.4.0

## 0.4.3

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.3.3

## 0.4.2

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.3.2

## 0.4.1

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.3.1

## 0.4.0

### Minor Changes

- [#1801](https://github.com/bluesky-social/atproto/pull/1801) [`ce49743d`](https://github.com/bluesky-social/atproto/commit/ce49743d7f8800d33116b88001d7b512553c2c89) Thanks [@gaearon](https://github.com/gaearon)! - Methods that accepts lexicons now take `LexiconDoc` type instead of `unknown`

### Patch Changes

- [#1788](https://github.com/bluesky-social/atproto/pull/1788) [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423) Thanks [@bnewbold](https://github.com/bnewbold)! - update license to "MIT or Apache2"

- Updated dependencies [[`ce49743d`](https://github.com/bluesky-social/atproto/commit/ce49743d7f8800d33116b88001d7b512553c2c89), [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/lexicon@0.3.0

## 0.3.3

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.2.3

## 0.3.2

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.2.2

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @atproto/lexicon@0.2.1
