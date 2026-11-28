---
'@atproto/bsky': patch
'@atproto/dev-env': patch
'@atproto/ozone': patch
---

Add `assetPath()` to resolve the test image assets independently of the working directory. `SeedClient.uploadFile()` now uses the file name, rather than the path, as the image alt text.
