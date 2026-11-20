---
'@atproto/xrpc-server': patch
---

Destroy handler-returned streams when piping to an already-closed response. `pipeline()` rejects with `ERR_STREAM_UNABLE_TO_PIPE` without destroying the source if the client disconnected while an async handler was still resolving, which leaked the upstream connection (e.g. remote object storage behind `getBlob`).
