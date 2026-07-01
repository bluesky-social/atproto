---
'@atproto/aws': patch
---

`S3BlobStore`: decouple the per-request stall detection timeout (`requestTimeoutMs`, a socket idle timeout) from the total upload budget (`uploadTimeoutMs`). `requestTimeoutMs` now defaults to `min(uploadTimeoutMs, 15s)` (clamped to a minimum of 6s) instead of `uploadTimeoutMs`, so that stalled S3 connections are reaped and retried quickly even when a large upload timeout is configured. The 6s floor keeps the socket idle timeout from applying to blob downloads streamed to slow (client-paced) consumers. Also adds a `connectionTimeoutMs` option (default 5s), and translates stalled-connection `TimeoutError`s into the same "Blob upload timed out" error as upload timeouts.
