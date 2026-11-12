---
"@atproto/pds": minor
---

When a managed space's managing app can't be resolved, errors, or doesn't answer within 10 seconds, the space host fails with `UpstreamFailure` rather than refusing access. `authorizeSpaceSync` still issues no credential, but leaves the request's notify registration in place, and a repo host retries its `notifyRepoUpdate` rather than dropping it.
