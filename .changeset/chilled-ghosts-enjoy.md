---
'@atproto/api': minor
---

Improve `resumeSession` event emission. It will no longer double emit when some
requests fail, and the `create-failed` event has been replaced by `expired`
where appropriate, and with a new event `network-error` where appropriate or an
unknown error occurs.
