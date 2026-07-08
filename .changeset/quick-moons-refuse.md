---
'@atproto/oauth-types': minor
'@atproto/oauth-provider': minor
'@atproto/oauth-client-browser': minor
---

Accept `http://localhost` redirect URIs for loopback (development) clients, in addition to the `http://127.0.0.1` and `http://[::1]` loopback IP literals, per the updated atproto OAuth spec. `http://localhost/` is added to the default loopback redirect URIs (the loopback IP literals remain the default). The browser client no longer redirects the user away from a `localhost` origin when it matches one of the client's explicitly configured redirect URIs. Client behavior is otherwise unchanged: using a `localhost` redirect URI is opt-in, and requires an Authorization Server that accepts them.
