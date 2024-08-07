---
"@atproto/lex-cli": minor
"@atproto/xrpc": minor
"@atproto/api": minor
"@atproto/dev-env": patch
"@atproto/lexicon": patch
"@atproto/ozone": patch
"@atproto/bsky": patch
"@atproto/pds": patch
---

**New Features**:

1) We've restructured the `XrpcClient` HTTP fetch handler to be specified during
   the instantiation of the XRPC client, through the constructor, instead of
   being a default property of the class.
2) With this refactor, the XRPC client is now more adaptable to various use
   cases. In particular, session management, retries, and other request-specific
   logic (signing, etc.) can be implemented in the fetch handler itself rather
   than by the calling code.
3) A new abstract class named `Agent`, has been added to `@atproto/api`. This
   class is the base class for all Bluesky agents classes in the `@atproto`
   ecosystem. It is meant to be extended by implementation that provide
   session management and fetch handling for the `AtpClient` instances.

**Deprecations**:

- The default export of the `@atproto/xrpc` package has been deprecated. Use
  named exports instead.

- The default export of the `@atproto/api` package has been deprecated. Use
  named exports instead.

- The `xrpc` property of the `AtpClient` instances has been deprecated. The
  instance itself should be used as the XRPC client.

- The `api` property of the `AtpAgent` and `BskyAgent` instances has been
  deprecated. Use the instance itself instead.

- The `BskyAgent` has been deprecated. Use the `AtpAgent` class instead.

**Compatibility**:

Most of the changes introduced in this version are backward-compatible. However,
there are a couple of breaking changes you should be aware of:

- Customizing `fetch`: The ability to customize the `fetch: FetchHandler`
  property of the  the XRPC Client and AtpAgent classes has been modified.
  Previously, the `fetch` property could be set (and changed) to a function that
  would be used as the fetch handler for that instance, and was initialized to
  a default fetch handler. That property was renamed to `fetchHandler` and is
  now a read-only property that can only be set during the instance creation.
  Attempting to set/get the `fetch` property will now result in an error.

- The `setHeader` and `unsetHeader` of the `XrpcClient` have been change to
  become case insensitive. This means that the header name is now case
  insensitive. This might cause issues in code that was setting the same header
  with different cases.

- The `fetch()` method, as well as WhatWG compliant `Request` and `Headers`
  constructors, must be globally available in your environment. Use a polyfill
  if necessary.

- The `AtpBaseClient` has been removed. The `AtpServiceClient` has been renamed
  `AtpBaseClient`. Any code using either of these classes will need to be
  updated.

- Instead of wrapping an `XrpcClient` in the `xrpc` property, the
  `AtpBaseClient` (formerly `AtpServiceClient`) class, created through
  `lex-cli`, now extends the `XrpcClient` class. This means that a client
  instance now passes the `instanceof XrpcClient` check. The `xrpc` property now
  returns the instance itself and has been deprecated.

- The `com.*` and `app.*` namespaces have been made directly available
  to every `Agent` instances, not only on `BskyAgent` instances.
