---
'@atproto/dev-env': patch
---

Reserve test server ports across processes to prevent parallel test workers from selecting the same port.
