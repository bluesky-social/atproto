---
'@atproto/pds': patch
---

Remove the `glob` dependency. It was only used by the mailer template build script, which now uses the `globSync` built into `node:fs`.
