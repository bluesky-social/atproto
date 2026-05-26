# @atproto/common-web — Browser-safe shared utilities

The web-platform-compatible subset of `@atproto/common`. No Node imports. Consumed by `@atproto/api` and other libraries that need to run in browsers.

If you add a helper here, make sure it really works in a browser — no `Buffer`, no `node:*` imports, no fs/streams.
