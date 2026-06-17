---
'@atproto/oauth-client': patch
---

Avoid relying on `AbortSignal.timeout`, which is not implemented in every runtime this package targets (notably React Native / Expo) and caused `TypeError: AbortSignal.timeout is not a function` during the OAuth login flow. A `timeoutSignal` helper now feature-detects the native static method and falls back to an `AbortController` + `setTimeout` when it is missing.
