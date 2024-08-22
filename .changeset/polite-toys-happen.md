---
"@atproto/api": patch
---

`Agent` is no longer an abstract class. Instead it can be instantiated using object implementing a new `SessionManager` interface. If your project extends `Agent` and overrides the constructor or any method implementations, consider that you may want to call them from `super`.
