---
'@atproto/dev-env': patch
---

`TestNetworkNoAppView` accepts `extraPdses`, to start more PDSes, each with its own handle domain (`.test2`, `.test3`, …). `mockNetworkUtilities()` and `mockResolvers()` accept several PDSes, and the introspection server lists every PDS under `pdses`.
