---
'@atproto/aws': patch
---

Upgrade `@aws-sdk/*` dependencies (^3.879.0 to ^3.1073.0). `S3BlobStore` now passes its stall detection timeout (`requestTimeoutMs`) to the request handler's `socketTimeout` option: the upgraded SDK redefined `requestTimeout` from a socket idle timeout to a warn-only total request timer, so stalled S3 connections continue to be reaped and retried as intended.
