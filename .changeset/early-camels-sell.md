---
'@atproto/lex-client': patch
---

Create a specific error class for wrapping unexpected error returned by the `fetchHandler`. This allows to better distinguish unexpected internal server errors (due to implementation encountering an unexpected case) from potentially transient errors that occur when performing network HTTP requests.
