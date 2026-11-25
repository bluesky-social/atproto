---
'@atproto/lex-server': patch
---

Subscriptions yield to the event loop at least every 10ms. A handler that yields messages without awaiting, such as one replaying a backlog, no longer blocks I/O and timers, including the server's own termination, for as long as the socket accepts writes.
