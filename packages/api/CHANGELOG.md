# @atproto/api

## 0.13.18

### Patch Changes

- [#3082](https://github.com/bluesky-social/atproto/pull/3082) [`a3ce23c4c`](https://github.com/bluesky-social/atproto/commit/a3ce23c4ccf4f40998b9d1f5731e5c905390aedc) Thanks [@gaearon](https://github.com/gaearon)! - Add hotness as a thread sorting option

## 0.13.17

### Patch Changes

- [#2978](https://github.com/bluesky-social/atproto/pull/2978) [`a4b528e5f`](https://github.com/bluesky-social/atproto/commit/a4b528e5f51c8bfca56b293b0059b88d138ec421) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add searchStarterPacks and searchStarterPacksSkeleton

- [#3056](https://github.com/bluesky-social/atproto/pull/3056) [`2e7aa211d`](https://github.com/bluesky-social/atproto/commit/2e7aa211d2cbc629899c7f87f1713b13b932750b) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add com.atproto.temp.addReservedHandle lexicon

## 0.13.16

### Patch Changes

- [#2988](https://github.com/bluesky-social/atproto/pull/2988) [`48d08a469`](https://github.com/bluesky-social/atproto/commit/48d08a469f75837e3b7e879d286d12780440b8b8) Thanks [@foysalit](https://github.com/foysalit)! - Make durationInHours optional for mute reporter event

- [#2911](https://github.com/bluesky-social/atproto/pull/2911) [`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Export the generated lexicons `schemas` definitions

- [#2953](https://github.com/bluesky-social/atproto/pull/2953) [`561431fe4`](https://github.com/bluesky-social/atproto/commit/561431fe4897e81767dc768e9a31020d09bf86ff) Thanks [@rafaelbsky](https://github.com/rafaelbsky)! - Add convoView.opened to lexicon definition

- Updated dependencies [[`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d), [`bac9be2d3`](https://github.com/bluesky-social/atproto/commit/bac9be2d3ec904d1f984a871f43cf89aca17289d)]:
  - @atproto/syntax@0.3.1
  - @atproto/lexicon@0.4.3
  - @atproto/xrpc@0.6.4

## 0.13.15

### Patch Changes

- [#2661](https://github.com/bluesky-social/atproto/pull/2661) [`d6f33b474`](https://github.com/bluesky-social/atproto/commit/d6f33b4742e0b94722a993efc7d18833d9416bb6) Thanks [@foysalit](https://github.com/foysalit)! - Add mod events and status filter for account and record hosting status

- [#2957](https://github.com/bluesky-social/atproto/pull/2957) [`b6eeb81c6`](https://github.com/bluesky-social/atproto/commit/b6eeb81c6d454b5ae91b05a21fc1820274c1b429) Thanks [@gaearon](https://github.com/gaearon)! - Detect facets in parallel

- [#2917](https://github.com/bluesky-social/atproto/pull/2917) [`839202a3d`](https://github.com/bluesky-social/atproto/commit/839202a3d2b01de25de900cec7540019545798c6) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow instantiating an API Agent with a string or URL

- [#2933](https://github.com/bluesky-social/atproto/pull/2933) [`e680d55ca`](https://github.com/bluesky-social/atproto/commit/e680d55ca2d7f6b213e2a8693eba6be39163ba41) Thanks [@mozzius](https://github.com/mozzius)! - Fix handling of invalid facets in RichText

- [#2905](https://github.com/bluesky-social/atproto/pull/2905) [`c4b5e5395`](https://github.com/bluesky-social/atproto/commit/c4b5e53957463c37dd16fdd1b897d4ab02ab8e84) Thanks [@foysalit](https://github.com/foysalit)! - Add user specific and instance-wide settings api for ozone

## 0.13.14

### Patch Changes

- [#2918](https://github.com/bluesky-social/atproto/pull/2918) [`209238769`](https://github.com/bluesky-social/atproto/commit/209238769c0bf38bf04f7fa9621eeb176b5c0ed8) Thanks [@devinivy](https://github.com/devinivy)! - add app.bsky.unspecced.getConfig endpoint

- [#2931](https://github.com/bluesky-social/atproto/pull/2931) [`73f40e63a`](https://github.com/bluesky-social/atproto/commit/73f40e63abe3283efc0a27eef781c00b497caad1) Thanks [@dholms](https://github.com/dholms)! - Add threatSignatures to ozone repo views

## 0.13.13

### Patch Changes

- [#2914](https://github.com/bluesky-social/atproto/pull/2914) [`19e36afb2`](https://github.com/bluesky-social/atproto/commit/19e36afb2c13dbc7b1033eb3cab5e7fc6f496fdc) Thanks [@foysalit](https://github.com/foysalit)! - Add collections and subjectType filters to ozone's queryEvents and queryStatuses endpoints

## 0.13.12

### Patch Changes

- [#2636](https://github.com/bluesky-social/atproto/pull/2636) [`22d039a22`](https://github.com/bluesky-social/atproto/commit/22d039a229e3ef08a793e1c98b473b1b8e18ac5e) Thanks [@foysalit](https://github.com/foysalit)! - Sets api to manage lists of strings on ozone, mostly aimed for automod configuration

## 0.13.11

### Patch Changes

- [#2857](https://github.com/bluesky-social/atproto/pull/2857) [`a0531ce42`](https://github.com/bluesky-social/atproto/commit/a0531ce429f5139cb0e2cc19aa9b338599947e44) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds support for muting words within link cards attached to `RecordWithMedia` embeds.

## 0.13.10

### Patch Changes

- [#2855](https://github.com/bluesky-social/atproto/pull/2855) [`df14df522`](https://github.com/bluesky-social/atproto/commit/df14df522bb7986e56ee1f6a0f5d862e1ea6f4d5) Thanks [@dholms](https://github.com/dholms)! - Add tools.ozone.signature lexicons

## 0.13.9

### Patch Changes

- [#2836](https://github.com/bluesky-social/atproto/pull/2836) [`a2bad977a`](https://github.com/bluesky-social/atproto/commit/a2bad977a8d941b4075ea3ffee3d6f7a0c0f467c) Thanks [@foysalit](https://github.com/foysalit)! - Add getRepos and getRecords endpoints for bulk fetching

## 0.13.8

### Patch Changes

- [#2771](https://github.com/bluesky-social/atproto/pull/2771) [`2676206e4`](https://github.com/bluesky-social/atproto/commit/2676206e422233fefbf2d9d182e8d462f0957c93) Thanks [@mozzius](https://github.com/mozzius)! - Add pinned posts to profile record and getAuthorFeed

- Updated dependencies [[`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`a07b21151`](https://github.com/bluesky-social/atproto/commit/a07b21151f1850340c4b7797ebb11521b1a6cdf3), [`eb20ff64a`](https://github.com/bluesky-social/atproto/commit/eb20ff64a2d8e3061c652e1e247bf9b0fe3c41a6), [`87a1f2426`](https://github.com/bluesky-social/atproto/commit/87a1f24262e0e644b6cf31cc7a0446d9127ffa94)]:
  - @atproto/xrpc@0.6.3
  - @atproto/common-web@0.3.1
  - @atproto/lexicon@0.4.2

## 0.13.7

### Patch Changes

- [#2807](https://github.com/bluesky-social/atproto/pull/2807) [`e6bd5aecc`](https://github.com/bluesky-social/atproto/commit/e6bd5aecce7954d60e5fb263297e697ab7aab98e) Thanks [@foysalit](https://github.com/foysalit)! - Introduce a acknowledgeAccountSubjects flag on takedown event to ack all subjects from the author that need review

- [#2810](https://github.com/bluesky-social/atproto/pull/2810) [`33aa0c722`](https://github.com/bluesky-social/atproto/commit/33aa0c722226a18215af0ae1833c7c552fc7aaa7) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add NUX API

- Updated dependencies [[`98711a147`](https://github.com/bluesky-social/atproto/commit/98711a147a8674337f605c6368f39fc10c2fae93)]:
  - @atproto/xrpc@0.6.2

## 0.13.6

### Patch Changes

- [#2780](https://github.com/bluesky-social/atproto/pull/2780) [`e4d41d66f`](https://github.com/bluesky-social/atproto/commit/e4d41d66fa4757a696363f39903562458967b63d) Thanks [@foysalit](https://github.com/foysalit)! - Add language property to communication templates

## 0.13.5

### Patch Changes

- [#2751](https://github.com/bluesky-social/atproto/pull/2751) [`80ada8f47`](https://github.com/bluesky-social/atproto/commit/80ada8f47628f55f3074cd16a52857e98d117e14) Thanks [@devinivy](https://github.com/devinivy)! - Lexicons and support for video embeds within bsky posts.

## 0.13.4

### Patch Changes

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Drop use of `AtpBaseClient` class

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Expose the `CredentialSession` class that can be used to instantiate both `Agent` and `XrpcClient`, while internally managing credential based (username/password) sessions.

- [`bbca17bc5`](https://github.com/bluesky-social/atproto/commit/bbca17bc5388e0b2af26fb107347c8ab507ee42f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Deprecate Agent.accountDid in favor of Agent.assertDid

- [#2737](https://github.com/bluesky-social/atproto/pull/2737) [`a8e1f9000`](https://github.com/bluesky-social/atproto/commit/a8e1f9000d9617c4df9d9f0e74ae0e0b73fcfd66) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `threadgate: ThreadgateView` to response from `getPostThread`

- [#2714](https://github.com/bluesky-social/atproto/pull/2714) [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - `Agent` is no longer an abstract class. Instead it can be instantiated using object implementing a new `SessionManager` interface. If your project extends `Agent` and overrides the constructor or any method implementations, consider that you may want to call them from `super`.

- Updated dependencies [[`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c), [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c), [`d9ffa3c46`](https://github.com/bluesky-social/atproto/commit/d9ffa3c460924010d7002b616cb7a0c66111cc6c)]:
  - @atproto/xrpc@0.6.1

## 0.13.3

### Patch Changes

- [#2735](https://github.com/bluesky-social/atproto/pull/2735) [`4ab248354`](https://github.com/bluesky-social/atproto/commit/4ab2483547d5dabfba88ed4419a4f374bbd7cae7) Thanks [@haileyok](https://github.com/haileyok)! - add `quoteCount` to embed view

## 0.13.2

### Patch Changes

- [#2658](https://github.com/bluesky-social/atproto/pull/2658) [`2a0c088cc`](https://github.com/bluesky-social/atproto/commit/2a0c088cc5d502ca70da9612a261186aa2f2e1fb) Thanks [@haileyok](https://github.com/haileyok)! - Adds `app.bsky.feed.getQuotes` lexicon and handlers

- [#2675](https://github.com/bluesky-social/atproto/pull/2675) [`aba664fbd`](https://github.com/bluesky-social/atproto/commit/aba664fbdfbaddba321e96db2478e0bc8fc72d27) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds `postgate` records to power quote gating and detached quote posts, plus `hiddenReplies` to the `threadgate` record.

## 0.13.1

### Patch Changes

- [#2708](https://github.com/bluesky-social/atproto/pull/2708) [`22af354a5`](https://github.com/bluesky-social/atproto/commit/22af354a5db595d7cbc0e65f02601de3565337e1) Thanks [@devinivy](https://github.com/devinivy)! - Export AtpAgentOptions type to better support extending AtpAgent.

## 0.13.0

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

- Updated dependencies [[`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`2bdf75d7a`](https://github.com/bluesky-social/atproto/commit/2bdf75d7a63924c10e7a311f16cb447d595b933e), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd), [`b934b396b`](https://github.com/bluesky-social/atproto/commit/b934b396b13ba32bf2bf7e75ecdf6871e5f310dd)]:
  - @atproto/lexicon@0.4.1
  - @atproto/xrpc@0.6.0

## 0.12.29

### Patch Changes

- [#2668](https://github.com/bluesky-social/atproto/pull/2668) [`dc471da26`](https://github.com/bluesky-social/atproto/commit/dc471da267955d0962a8affaf983df60d962d97c) Thanks [@dholms](https://github.com/dholms)! - Add lxm and exp parameters to com.atproto.server.getServiceAuth

## 0.12.28

### Patch Changes

- [#2676](https://github.com/bluesky-social/atproto/pull/2676) [`951a3df15`](https://github.com/bluesky-social/atproto/commit/951a3df15aa9c1f5b0a2b66cfb0e2eaf6198fe41) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Remove `app.bsky.feed.detach` record, to be replaced by `app.bsky.feed.postgate` record in a future release.

## 0.12.27

### Patch Changes

- [#2664](https://github.com/bluesky-social/atproto/pull/2664) [`ff803fd2b`](https://github.com/bluesky-social/atproto/commit/ff803fd2bfad92eec5f88ee9b347c174731ef4ec) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds `app.bsky.feed.detach` record lexicons.

## 0.12.26

### Patch Changes

- [#2276](https://github.com/bluesky-social/atproto/pull/2276) [`77c5306d2`](https://github.com/bluesky-social/atproto/commit/77c5306d2a40d7edd20def73163b8f93f3a30ee7) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Updates muted words lexicons to include new attributes `id`, `actorTarget`, and `expiresAt`. Adds and updates methods in API SDK for better management of muted words.

## 0.12.25

### Patch Changes

- [#2570](https://github.com/bluesky-social/atproto/pull/2570) [`12dcdb668`](https://github.com/bluesky-social/atproto/commit/12dcdb668c8ec0f8a89689c326ab3e9dbc6d2f3c) Thanks [@sugyan](https://github.com/sugyan)! - Fix `hasMutedWord` for facets with multiple features

- [#2648](https://github.com/bluesky-social/atproto/pull/2648) [`76c91f832`](https://github.com/bluesky-social/atproto/commit/76c91f8325363c95e25349e8e236aa2f70e63d5b) Thanks [@dholms](https://github.com/dholms)! - Support for priority notifications

## 0.12.24

### Patch Changes

- [#2613](https://github.com/bluesky-social/atproto/pull/2613) [`ed5810179`](https://github.com/bluesky-social/atproto/commit/ed5810179006f254f2035fe1f0e3c4798080cfe0) Thanks [@haileyok](https://github.com/haileyok)! - Support for starter packs in record embed views.

- [#2554](https://github.com/bluesky-social/atproto/pull/2554) [`0529bec99`](https://github.com/bluesky-social/atproto/commit/0529bec99183439829a3553f45ac7203763144c3) Thanks [@sugyan](https://github.com/sugyan)! - Add missing `getPreferences` union return types

## 0.12.23

### Patch Changes

- [#2492](https://github.com/bluesky-social/atproto/pull/2492) [`bc861a2c2`](https://github.com/bluesky-social/atproto/commit/bc861a2c25b4151fb7e070dc20d5e1e07da21863) Thanks [@pfrazee](https://github.com/pfrazee)! - Added bsky app state preference and improved protections against race conditions in preferences sdk

## 0.12.22

### Patch Changes

- [#2553](https://github.com/bluesky-social/atproto/pull/2553) [`af7d3912a`](https://github.com/bluesky-social/atproto/commit/af7d3912a3b304a752ed72947eaa8cf28b35ec02) Thanks [@devinivy](https://github.com/devinivy)! - Support for starter packs (app.bsky.graph.starterpack)

## 0.12.21

### Patch Changes

- [#2460](https://github.com/bluesky-social/atproto/pull/2460) [`3ad051996`](https://github.com/bluesky-social/atproto/commit/3ad0519961e2437aa4870bf1358e6c275dcdee24) Thanks [@foysalit](https://github.com/foysalit)! - Add DB backed team member management for ozone

## 0.12.20

### Patch Changes

- [#2582](https://github.com/bluesky-social/atproto/pull/2582) [`ea0f10b5d`](https://github.com/bluesky-social/atproto/commit/ea0f10b5d0d334eb587032c54d5ace9ea811cf26) Thanks [@pfrazee](https://github.com/pfrazee)! - Remove client-side enforcement of labeler limits

## 0.12.19

### Patch Changes

- [#2558](https://github.com/bluesky-social/atproto/pull/2558) [`7c1973841`](https://github.com/bluesky-social/atproto/commit/7c1973841dab416ae19435d37853aeea1f579d39) Thanks [@dholms](https://github.com/dholms)! - Add thread mute routes and viewer state

## 0.12.18

### Patch Changes

- [#2557](https://github.com/bluesky-social/atproto/pull/2557) [`58abcbd8b`](https://github.com/bluesky-social/atproto/commit/58abcbd8b6e42a1f66bda6acc3ee6a2c0894e546) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds "social proof": `knowFollowers` to `ViewerState` for `ProfileViewDetailed`
  views and `app.bsky.graph.getKnownFollowers` method for listing known followers
  of a given user.

## 0.12.17

### Patch Changes

- [#2426](https://github.com/bluesky-social/atproto/pull/2426) [`2b21b5be2`](https://github.com/bluesky-social/atproto/commit/2b21b5be293d32c5eb5ae971c39703bc7d2224fd) Thanks [@foysalit](https://github.com/foysalit)! - Add com.atproto.admin.searchAccounts lexicon to allow searching for accounts using email address

## 0.12.16

### Patch Changes

- [#2539](https://github.com/bluesky-social/atproto/pull/2539) [`9495af23b`](https://github.com/bluesky-social/atproto/commit/9495af23bdb328cfc71182ac80e6eb61863d7a46) Thanks [@dholms](https://github.com/dholms)! - Allow updating deactivation state through admin.updateSubjectStatus

## 0.12.15

### Patch Changes

- [#2531](https://github.com/bluesky-social/atproto/pull/2531) [`255d5ea1f`](https://github.com/bluesky-social/atproto/commit/255d5ea1f06726547cdbe59c83bd18f2d4746912) Thanks [@dholms](https://github.com/dholms)! - Account deactivation. Current hosting status returned on session routes.

## 0.12.14

### Patch Changes

- [#2533](https://github.com/bluesky-social/atproto/pull/2533) [`c4af6a409`](https://github.com/bluesky-social/atproto/commit/c4af6a409ea2171c3cf1d0e7c8ed496794a3f049) Thanks [@devinivy](https://github.com/devinivy)! - Support for post embeds in chat lexicons

## 0.12.13

### Patch Changes

- [#2517](https://github.com/bluesky-social/atproto/pull/2517) [`1d4ab5d04`](https://github.com/bluesky-social/atproto/commit/1d4ab5d046aac4539658ee6d7e61882c54d5beb9) Thanks [@dholms](https://github.com/dholms)! - Add privileged flag to app password routes

## 0.12.12

### Patch Changes

- [#2442](https://github.com/bluesky-social/atproto/pull/2442) [`1f560f021`](https://github.com/bluesky-social/atproto/commit/1f560f021c07eb9e8d76577e67fd2d7ac39cdee4) Thanks [@foysalit](https://github.com/foysalit)! - Add com.atproto.label.queryLabels endpoint on appview and allow viewing external labels through ozone

## 0.12.11

### Patch Changes

- [#2499](https://github.com/bluesky-social/atproto/pull/2499) [`06d2328ee`](https://github.com/bluesky-social/atproto/commit/06d2328eeb8d706018dbdf7cc7b9862dd65b96cb) Thanks [@devinivy](https://github.com/devinivy)! - Misc tweaks and fixes to chat lexicons

## 0.12.10

### Patch Changes

- [#2485](https://github.com/bluesky-social/atproto/pull/2485) [`d32f7215f`](https://github.com/bluesky-social/atproto/commit/d32f7215f69bc87f50890d9cfdb09840c2fbaa41) Thanks [@devinivy](https://github.com/devinivy)! - Add lexicons for chat.bsky namespace

## 0.12.9

### Patch Changes

- [#2467](https://github.com/bluesky-social/atproto/pull/2467) [`f83b4c8ca`](https://github.com/bluesky-social/atproto/commit/f83b4c8cad01cebc1b67caa6c7ebe45f07b2f318) Thanks [@haileyok](https://github.com/haileyok)! - Modify label-handling on user's own content to still apply blurring

## 0.12.8

### Patch Changes

- [`58f719cc1`](https://github.com/bluesky-social/atproto/commit/58f719cc1c8d0ebd5ad7cf11221372b671cd7857) Thanks [@devinivy](https://github.com/devinivy)! - Add grandparent author to feed item reply ref

## 0.12.7

### Patch Changes

- [#2390](https://github.com/bluesky-social/atproto/pull/2390) [`58551bbe0`](https://github.com/bluesky-social/atproto/commit/58551bbe0595462c44fc3b6ab5b83e520f141933) Thanks [@foysalit](https://github.com/foysalit)! - Allow muting reports from accounts via `#modEventMuteReporter` event

## 0.12.6

### Patch Changes

- [#2427](https://github.com/bluesky-social/atproto/pull/2427) [`b9b7c5821`](https://github.com/bluesky-social/atproto/commit/b9b7c582199d57d2fe0af8af5c8c411ed34f5b9d) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Introduces V2 of saved feeds preferences. V2 and v1 prefs are incompatible. v1
  methods and preference objects are retained for backwards compatability, but are
  considered deprecated. Developers should immediately migrate to v2 interfaces.

## 0.12.5

### Patch Changes

- [#2419](https://github.com/bluesky-social/atproto/pull/2419) [`3424a1770`](https://github.com/bluesky-social/atproto/commit/3424a17703891f5678ec76ef97e696afb3288b22) Thanks [@pfrazee](https://github.com/pfrazee)! - Add authFactorToken to session objects

## 0.12.4

### Patch Changes

- [#2416](https://github.com/bluesky-social/atproto/pull/2416) [`93a4a4df9`](https://github.com/bluesky-social/atproto/commit/93a4a4df9ce38f89a5d05e300d247b85fb007e05) Thanks [@devinivy](https://github.com/devinivy)! - Support for email auth factor lexicons

## 0.12.3

### Patch Changes

- [#2383](https://github.com/bluesky-social/atproto/pull/2383) [`0edef0ec0`](https://github.com/bluesky-social/atproto/commit/0edef0ec01403fd6097a4d2875b68313f2f1261f) Thanks [@dholms](https://github.com/dholms)! - Added feed generator interaction lexicons

- [#2409](https://github.com/bluesky-social/atproto/pull/2409) [`c6d758b8b`](https://github.com/bluesky-social/atproto/commit/c6d758b8b63f4ef50b2ab9afc62164e92a53e7f0) Thanks [@devinivy](https://github.com/devinivy)! - Support for upcoming post search params

## 0.12.2

### Patch Changes

- [#2344](https://github.com/bluesky-social/atproto/pull/2344) [`abc6f82da`](https://github.com/bluesky-social/atproto/commit/abc6f82da38abef2b1bbe8d9e41a0534a5418c9e) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Support muting words that contain apostrophes and other punctuation

## 0.12.1

### Patch Changes

- [#2342](https://github.com/bluesky-social/atproto/pull/2342) [`eb7668c07`](https://github.com/bluesky-social/atproto/commit/eb7668c07d44f4b42ea2cc28143c64f4ba3312f5) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds the `associated` property to `profile` and `profile-basic` views, bringing them in line with `profile-detailed` views.

## 0.12.0

### Minor Changes

- [#2169](https://github.com/bluesky-social/atproto/pull/2169) [`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Build system rework, stop bundling dependencies.

### Patch Changes

- [#2338](https://github.com/bluesky-social/atproto/pull/2338) [`36f2e966c`](https://github.com/bluesky-social/atproto/commit/36f2e966cba6cc90ba4320520da5c7381cfb8086) Thanks [@pfrazee](https://github.com/pfrazee)! - Fix: correctly detected blocked quote-posts when moderating posts

- Updated dependencies [[`f689bd51a`](https://github.com/bluesky-social/atproto/commit/f689bd51a2f4e02d4eca40eb2568a1fcb95494e9)]:
  - @atproto/common-web@0.3.0
  - @atproto/lexicon@0.4.0
  - @atproto/syntax@0.3.0
  - @atproto/xrpc@0.5.0

## 0.11.2

### Patch Changes

- [#2328](https://github.com/bluesky-social/atproto/pull/2328) [`7dd9941b7`](https://github.com/bluesky-social/atproto/commit/7dd9941b73dbbd82601740e021cc87d765af60ca) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Remove unecessary escapes from regex, which was causing a minification error when bundled in React Native.

## 0.11.1

### Patch Changes

- [#2312](https://github.com/bluesky-social/atproto/pull/2312) [`219480764`](https://github.com/bluesky-social/atproto/commit/2194807644cbdb0021e867437693300c1b0e55f5) Thanks [@pfrazee](https://github.com/pfrazee)! - Fixed an issue that would cause agent clones to drop the PDS URI config.

## 0.11.0

### Minor Changes

- [#2302](https://github.com/bluesky-social/atproto/pull/2302) [`4eaadc0ac`](https://github.com/bluesky-social/atproto/commit/4eaadc0acb6b73b9745dd7a2b929d02e58083ab0) Thanks [@dholms](https://github.com/dholms)! - - Breaking changes
  - Redesigned the `moderate*` APIs which now output a `ModerationUI` object.
  - `agent.getPreferences()` output object `BskyPreferences` has been modified.
  - Moved Ozone routes from `com.atproto.admin` to `tools.ozone` namespace.
  - Additions
    - Added support for labeler configuration in `Agent.configure()` and `agent.configureLabelerHeader()`.
    - Added `agent.addLabeler()` and `agent.removeLabeler()` preference methods.
    - Muted words and hidden posts are now handled in the `moderate*` APIs.
    - Added `agent.getLabelers()` and `agent.getLabelDefinitions()`.
    - Added `agent.configureProxyHeader()` and `withProxy()` methods to support remote service proxying behaviors.

### Patch Changes

- Updated dependencies [[`4eaadc0ac`](https://github.com/bluesky-social/atproto/commit/4eaadc0acb6b73b9745dd7a2b929d02e58083ab0)]:
  - @atproto/common-web@0.2.4
  - @atproto/lexicon@0.3.3
  - @atproto/syntax@0.2.1
  - @atproto/xrpc@0.4.3

## 0.10.5

### Patch Changes

- [#2279](https://github.com/bluesky-social/atproto/pull/2279) [`192223f12`](https://github.com/bluesky-social/atproto/commit/192223f127c0b226287df1ecfcd953636db08655) Thanks [@gaearon](https://github.com/gaearon)! - Change Following feed prefs to only show replies from people you follow by default

## 0.10.4

### Patch Changes

- [#2260](https://github.com/bluesky-social/atproto/pull/2260) [`6ec885992`](https://github.com/bluesky-social/atproto/commit/6ec8859929a16f9725319cc398b716acf913b01f) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Export regex from rich text detection

- [#2260](https://github.com/bluesky-social/atproto/pull/2260) [`6ec885992`](https://github.com/bluesky-social/atproto/commit/6ec8859929a16f9725319cc398b716acf913b01f) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Disallow rare unicode whitespace characters from tags

- [#2260](https://github.com/bluesky-social/atproto/pull/2260) [`6ec885992`](https://github.com/bluesky-social/atproto/commit/6ec8859929a16f9725319cc398b716acf913b01f) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Allow tags to lead with numbers

## 0.10.3

### Patch Changes

- [#2247](https://github.com/bluesky-social/atproto/pull/2247) [`2a0ceb818`](https://github.com/bluesky-social/atproto/commit/2a0ceb8180faa17de8061d4fa6c361b57a2005ed) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Fix double sanitization bug when editing muted words.

- [#2247](https://github.com/bluesky-social/atproto/pull/2247) [`2a0ceb818`](https://github.com/bluesky-social/atproto/commit/2a0ceb8180faa17de8061d4fa6c361b57a2005ed) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - More sanitization of muted words, including newlines and leading/trailing whitespace

- [#2247](https://github.com/bluesky-social/atproto/pull/2247) [`2a0ceb818`](https://github.com/bluesky-social/atproto/commit/2a0ceb8180faa17de8061d4fa6c361b57a2005ed) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `sanitizeMutedWordValue` util

- [#2247](https://github.com/bluesky-social/atproto/pull/2247) [`2a0ceb818`](https://github.com/bluesky-social/atproto/commit/2a0ceb8180faa17de8061d4fa6c361b57a2005ed) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Handle hash emoji in mute words

## 0.10.2

### Patch Changes

- [#2245](https://github.com/bluesky-social/atproto/pull/2245) [`61b3d2525`](https://github.com/bluesky-social/atproto/commit/61b3d25253353db2da1336004f94e7dc5adb0410) Thanks [@mary-ext](https://github.com/mary-ext)! - Prevent hashtag emoji from being parsed as a tag

- [#2218](https://github.com/bluesky-social/atproto/pull/2218) [`43531905c`](https://github.com/bluesky-social/atproto/commit/43531905ce1aec6d36d9be5943782811ecca6e6d) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Fix mute word upsert logic by ensuring we're comparing sanitized word values

- [#2245](https://github.com/bluesky-social/atproto/pull/2245) [`61b3d2525`](https://github.com/bluesky-social/atproto/commit/61b3d25253353db2da1336004f94e7dc5adb0410) Thanks [@mary-ext](https://github.com/mary-ext)! - Properly calculate length of tag

- Updated dependencies [[`0c815b964`](https://github.com/bluesky-social/atproto/commit/0c815b964c030aa0f277c40bf9786f130dc320f4)]:
  - @atproto/syntax@0.2.0
  - @atproto/lexicon@0.3.2
  - @atproto/xrpc@0.4.2

## 0.10.1

### Patch Changes

- [#2215](https://github.com/bluesky-social/atproto/pull/2215) [`514aab92d`](https://github.com/bluesky-social/atproto/commit/514aab92d26acd43859285f46318e386846522b1) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add missing `getPreferences` union return types

## 0.10.0

### Minor Changes

- [#2170](https://github.com/bluesky-social/atproto/pull/2170) [`4c511b3d9`](https://github.com/bluesky-social/atproto/commit/4c511b3d9de41ffeae3fc11db941e7df04f4468a) Thanks [@dholms](https://github.com/dholms)! - Add lexicons and methods for account migration

### Patch Changes

- [#2195](https://github.com/bluesky-social/atproto/pull/2195) [`b60719480`](https://github.com/bluesky-social/atproto/commit/b60719480f5f00bffd074a40e8ddc03aa93d137d) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add muted words/tags and hidden posts prefs and methods"

## 0.9.8

### Patch Changes

- [#2192](https://github.com/bluesky-social/atproto/pull/2192) [`f79cc6339`](https://github.com/bluesky-social/atproto/commit/f79cc63390ae9dbd47a4ff5d694eec25b78b788e) Thanks [@foysalit](https://github.com/foysalit)! - Tag event on moderation subjects and allow filtering events and subjects by tags

## 0.9.7

### Patch Changes

- [#2188](https://github.com/bluesky-social/atproto/pull/2188) [`8c94979f7`](https://github.com/bluesky-social/atproto/commit/8c94979f73fc5057449e24e66ef2e09b0e17e55b) Thanks [@dholms](https://github.com/dholms)! - Added timelineIndex to savedFeedsPref

## 0.9.6

### Patch Changes

- [#2124](https://github.com/bluesky-social/atproto/pull/2124) [`e4ec7af03`](https://github.com/bluesky-social/atproto/commit/e4ec7af03608949fc3b00a845f547a77599b5ad0) Thanks [@foysalit](https://github.com/foysalit)! - Allow filtering for comment, label, report type and date range on queryModerationEvents endpoint.

## 0.9.5

### Patch Changes

- [#2090](https://github.com/bluesky-social/atproto/pull/2090) [`8994d363`](https://github.com/bluesky-social/atproto/commit/8994d3633adad1c02569d6d44ae896e18195e8e2) Thanks [@dholms](https://github.com/dholms)! - add checkSignupQueue method and expose refreshSession on agent

## 0.9.4

### Patch Changes

- [#2086](https://github.com/bluesky-social/atproto/pull/2086) [`4171c04a`](https://github.com/bluesky-social/atproto/commit/4171c04ad81c5734a4558bc41fa1c4f3a1aba18c) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `setInterestsPref` method to BskyAgent, and `interests` prop to
  `getPreferences` response.

## 0.9.3

### Patch Changes

- [#2081](https://github.com/bluesky-social/atproto/pull/2081) [`5368245a`](https://github.com/bluesky-social/atproto/commit/5368245a6ef7095c86ad166fb04ff9bef27c3c3e) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add unspecced route for new onboarding `app.bsky.unspecced.getTaggedSuggestions`

## 0.9.2

### Patch Changes

- [#2045](https://github.com/bluesky-social/atproto/pull/2045) [`15f38560`](https://github.com/bluesky-social/atproto/commit/15f38560b9e2dc3af8cf860826e7477234fe6a2d) Thanks [@foysalit](https://github.com/foysalit)! - support new lexicons for admin communication templates

## 0.9.1

### Patch Changes

- [#2062](https://github.com/bluesky-social/atproto/pull/2062) [`c6fc73ae`](https://github.com/bluesky-social/atproto/commit/c6fc73aee6c245d12f876abd11889b8dbd0ce2ed) Thanks [@dholms](https://github.com/dholms)! - Directly pass create account params in api agent

## 0.9.0

### Minor Changes

- [#2039](https://github.com/bluesky-social/atproto/pull/2039) [`bf8d718c`](https://github.com/bluesky-social/atproto/commit/bf8d718cf918ac8d8a2cb1f57fde80535284642d) Thanks [@dholms](https://github.com/dholms)! - Namespace lexicon codegen

### Patch Changes

- [#2056](https://github.com/bluesky-social/atproto/pull/2056) [`e43396af`](https://github.com/bluesky-social/atproto/commit/e43396af0973748dd2d034e88d35cf7ae8b4df2c) Thanks [@dholms](https://github.com/dholms)! - Added phone verification methods/schemas to agent.

- [#1988](https://github.com/bluesky-social/atproto/pull/1988) [`51fcba7a`](https://github.com/bluesky-social/atproto/commit/51fcba7a7945c604fc50e9545850a12ef0ee6da6) Thanks [@bnewbold](https://github.com/bnewbold)! - remove deprecated app.bsky.unspecced.getPopular endpoint

## 0.8.0

### Minor Changes

- [#2010](https://github.com/bluesky-social/atproto/pull/2010) [`14067733`](https://github.com/bluesky-social/atproto/commit/140677335f76b99129c1f593d9e11d64624386c6) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Improve `resumeSession` event emission. It will no longer double emit when some
  requests fail, and the `create-failed` event has been replaced by `expired`
  where appropriate, and with a new event `network-error` where appropriate or an
  unknown error occurs.

## 0.7.4

### Patch Changes

- [#1966](https://github.com/bluesky-social/atproto/pull/1966) [`8f3f43cb`](https://github.com/bluesky-social/atproto/commit/8f3f43cb40f79ff7c52f81290daec55cfb000093) Thanks [@pfrazee](https://github.com/pfrazee)! - Fix to the application of the no-unauthenticated label

## 0.7.3

### Patch Changes

- [#1962](https://github.com/bluesky-social/atproto/pull/1962) [`7dec9df3`](https://github.com/bluesky-social/atproto/commit/7dec9df3b583ee8c06c0c6a7e32c259820dc84a5) Thanks [@pfrazee](https://github.com/pfrazee)! - Add seenAt time to listNotifications output

## 0.7.2

### Patch Changes

- [#1776](https://github.com/bluesky-social/atproto/pull/1776) [`ffe39aae`](https://github.com/bluesky-social/atproto/commit/ffe39aae8394394f73bbfaa9047a8b5818aa053a) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Add `posts_and_author_threads` filter to `getAuthorFeed`

## 0.7.1

### Patch Changes

- [#1944](https://github.com/bluesky-social/atproto/pull/1944) [`60deea17`](https://github.com/bluesky-social/atproto/commit/60deea17622f7c574c18432a55ced4e1cdc1b3a1) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Strip trailing colon from URLs in rich-text facet detection.

## 0.7.0

### Minor Changes

- [#1937](https://github.com/bluesky-social/atproto/pull/1937) [`45352f9b`](https://github.com/bluesky-social/atproto/commit/45352f9b6d02aa405be94e9102424d983912ca5d) Thanks [@pfrazee](https://github.com/pfrazee)! - Add the !no-unauthenticated label to the moderation SDK

## 0.6.24

### Patch Changes

- [#1912](https://github.com/bluesky-social/atproto/pull/1912) [`378fc613`](https://github.com/bluesky-social/atproto/commit/378fc6132f621ca517897c9467ed5bba134b3776) Thanks [@devinivy](https://github.com/devinivy)! - Contains breaking lexicon changes: removing legacy com.atproto admin endpoints, making uri field required on app.bsky list views.

- Updated dependencies [[`3c0ef382`](https://github.com/bluesky-social/atproto/commit/3c0ef382c12a413cc971ae47ffb341236c545f60)]:
  - @atproto/syntax@0.1.5
  - @atproto/lexicon@0.3.1
  - @atproto/xrpc@0.4.1

## 0.6.23

### Patch Changes

- [#1806](https://github.com/bluesky-social/atproto/pull/1806) [`772736a0`](https://github.com/bluesky-social/atproto/commit/772736a01081f39504e1b19a1b3687783bb78f07) Thanks [@devinivy](https://github.com/devinivy)! - respect pds endpoint during session resumption

## 0.6.22

### Patch Changes

- [#1788](https://github.com/bluesky-social/atproto/pull/1788) [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423) Thanks [@bnewbold](https://github.com/bnewbold)! - update license to "MIT or Apache2"

- Updated dependencies [[`ce49743d`](https://github.com/bluesky-social/atproto/commit/ce49743d7f8800d33116b88001d7b512553c2c89), [`84e2d4d2`](https://github.com/bluesky-social/atproto/commit/84e2d4d2b6694f344d80c18672c78b650189d423)]:
  - @atproto/lexicon@0.3.0
  - @atproto/xrpc@0.4.0
  - @atproto/common-web@0.2.3
  - @atproto/syntax@0.1.4

## 0.6.21

### Patch Changes

- [#1779](https://github.com/bluesky-social/atproto/pull/1779) [`9c98a5ba`](https://github.com/bluesky-social/atproto/commit/9c98a5baaf503b02238a6afe4f6e2b79c5181693) Thanks [@pfrazee](https://github.com/pfrazee)! - modlist helpers added to bsky-agent, add blockingByList to viewer state lexicon

- [`35d108ce`](https://github.com/bluesky-social/atproto/commit/35d108ce94866ce1b3d147cd0620a0ba1c4ebcd7) Thanks [@devinivy](https://github.com/devinivy)! - Allow pds to serve did doc with credentials, API client to respect PDS listed in the did doc.

- Updated dependencies [[`35d108ce`](https://github.com/bluesky-social/atproto/commit/35d108ce94866ce1b3d147cd0620a0ba1c4ebcd7)]:
  - @atproto/common-web@0.2.2
  - @atproto/lexicon@0.2.3
  - @atproto/syntax@0.1.3
  - @atproto/xrpc@0.3.3

## 0.6.20

### Patch Changes

- [#1568](https://github.com/bluesky-social/atproto/pull/1568) [`41ee177f`](https://github.com/bluesky-social/atproto/commit/41ee177f5a440490280d17acd8a89bcddaffb23b) Thanks [@dholms](https://github.com/dholms)! - Added email verification and update flows

- Updated dependencies [[`41ee177f`](https://github.com/bluesky-social/atproto/commit/41ee177f5a440490280d17acd8a89bcddaffb23b)]:
  - @atproto/common-web@0.2.1
  - @atproto/lexicon@0.2.2
  - @atproto/syntax@0.1.2
  - @atproto/xrpc@0.3.2

## 0.6.19

### Patch Changes

- [#1674](https://github.com/bluesky-social/atproto/pull/1674) [`35b616cd`](https://github.com/bluesky-social/atproto/commit/35b616cd82232879937afc88d3f77d20c6395276) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Strip leading `#` from from detected tag facets

## 0.6.18

### Patch Changes

- [#1651](https://github.com/bluesky-social/atproto/pull/1651) [`2ce8a11b`](https://github.com/bluesky-social/atproto/commit/2ce8a11b8daf5d39027488c5dde8c47b0eb937bf) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds support for hashtags in the `RichText.detectFacets` method.

## 0.6.17

### Patch Changes

- [#1637](https://github.com/bluesky-social/atproto/pull/1637) [`d96f7d9b`](https://github.com/bluesky-social/atproto/commit/d96f7d9b84c6fbab9711059c8584a77d892dcedd) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Introduce general support for tags on posts

## 0.6.16

### Patch Changes

- [#1653](https://github.com/bluesky-social/atproto/pull/1653) [`56e2cf89`](https://github.com/bluesky-social/atproto/commit/56e2cf8999f6d7522529a9be8652c47545f82242) Thanks [@pfrazee](https://github.com/pfrazee)! - Improve the types of the thread and feed preferences APIs

## 0.6.15

### Patch Changes

- [#1639](https://github.com/bluesky-social/atproto/pull/1639) [`2cc329f2`](https://github.com/bluesky-social/atproto/commit/2cc329f26547217dd94b6bb11ee590d707cbd14f) Thanks [@pfrazee](https://github.com/pfrazee)! - Added new preferences for feed and thread view behaviors.

## 0.6.14

### Patch Changes

- Updated dependencies [[`b1dc3555`](https://github.com/bluesky-social/atproto/commit/b1dc355504f9f2e047093dc56682b8034518cf80)]:
  - @atproto/syntax@0.1.1
  - @atproto/lexicon@0.2.1
  - @atproto/xrpc@0.3.1

## 0.6.13

### Patch Changes

- [#1553](https://github.com/bluesky-social/atproto/pull/1553) [`3877210e`](https://github.com/bluesky-social/atproto/commit/3877210e7fb3c76dfb1a11eb9ba3f18426301d9f) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Adds a new method `app.bsky.graph.getSuggestedFollowsByActor`. This method
  returns suggested follows for a given actor based on their likes and follows.
