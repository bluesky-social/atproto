---
"@atproto/bsky": patch
---

Speed up the test suite: integration tests share a worker and load workspace packages natively instead of re-transforming and re-importing the dev-env graph in every file
