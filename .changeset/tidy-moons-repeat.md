---
'@atproto-labs/fetch-node': minor
'@atproto-labs/fetch': patch
---

`safeFetchWrap()` now applies its url policy — the protocol, custom port,
hostname, forbidden-domain-name and literal-IP checks — to every request it
issues, rather than only to the one it was handed. The policy runs again at
dispatch time, which is the layer that observes each redirect hop, and a hop is
refused before its connection is made.

The dispatcher is installed even when `ssrfProtection` (or `allowPrivateIps`)
relaxes the unicast requirement, so relaxing that no longer relaxes the
remaining checks along with it. As a consequence, a custom `dispatcher` can no
longer be supplied through the request init in that configuration.

This requires undici's `Dispatcher.compose()`, which is feature-detected rather
than inferred from a version number: on a NodeJS whose bundled undici predates
it, constructing a safe fetch now throws instead of issuing requests without the
per-hop checks.

Redirect handling itself is unchanged: bodies are still replayed across 307/308,
methods still downgrade on 301/302/303, and the existing timeout still covers
the whole chain rather than a single hop.

`@atproto-labs/fetch` exposes the policy as three url-level predicates —
`checkProtocolPolicy()`, `checkHostHeaderPolicy()` and
`checkForbiddenDomainNamePolicy()` — which return the reason a url is
unacceptable instead of throwing. The request transforms built on them are
unchanged, status codes included.
