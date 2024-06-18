# Ppolyfill for Symbol.dispose and Symbol.asyncDispose

While typescript does transpile `using` to `try`/`finally` blocks, it does not
provide a polyfill for the `Symbol.dispose` and `Symbol.asyncDispose` symbols.
This package provides a polyfill for these symbols.

This _could_ be used as a standalone library, but the Bluesky dev team does not
want to maintain it as such. As it is currently only used by the
`@atproto/oauth-client-browser` package, it is included here.
