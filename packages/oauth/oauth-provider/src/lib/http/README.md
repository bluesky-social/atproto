# utilities for generating middlewares to work with Node's http module or Express / Connect frameworks

This library uses a functional programming style to generate middleware
functions that can be used with Node's http module or Express / Connect
frameworks.

This code _could_ be used as a standalone library, but the Bluesky dev team does
not want to maintain it as such. As it is currently only used by the
`@atproto/oauth-provider` package, it is included here. Future development
should aim to keep this library independent of the rest of the
`@atproto/oauth-provider` package, so that it can be extracted and published.
