---
'@atproto/oauth-client': patch
---

Remove implicit `any` types in internal utilities (`runtime`, `oauth-response-error`, `fetch-dpop`) so the package type-checks under `noImplicitAny`. No runtime behavior change.
