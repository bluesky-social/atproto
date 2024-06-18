# Safe HTML generation and concatenation utility

This library provides a safe way to generate and concatenate HTML strings.

This code _could_ be used as a standalone library, but the Bluesky dev team does
not want to maintain it as such. As it is currently only used by the
`@atproto/oauth-provider` package, it is included here. Future development
should aim to keep this library independent of the rest of the
`@atproto/oauth-provider` package, so that it can be extracted and published.
