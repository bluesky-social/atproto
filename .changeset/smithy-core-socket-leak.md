---
'@atproto/aws': patch
---

Pin `@smithy/core` to `>=3.29.5` to fix an outbound S3/R2 socket leak. Earlier versions did not destroy the underlying stream's socket when a `getObject` download was aborted mid-transfer (`ChecksumStream` swallowed the premature close), so `S3BlobStore` blob downloads that clients cancelled leaked sockets and file descriptors until the host exhausted TCP memory. `@smithy/core` 3.29.5 (smithy-typescript#2152) destroys the source and removes its listeners on premature closure.
