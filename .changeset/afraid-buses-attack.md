---
'@atproto/repo': minor
---

**Breaking**: Remove `zod` from the public interface. The `schema` export (an object of zod schemas) is removed, and the `def` entries and `nodeDataDef` are now `check.Def` objects from `@atproto/common-web`, whose `schema` only exposes `parse()` and `safeParse()`.
