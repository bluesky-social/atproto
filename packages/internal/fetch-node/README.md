# Node.js fetch utilities

Fetch helpers for Node.js 22+ that help protect services when fetching URLs supplied by users.

## Usage

Create a fetch wrapper once and reuse it:

```js
import { safeFetchWrap } from '@atproto-labs/fetch-node'

const safeFetch = safeFetchWrap()
const response = await safeFetch('https://api.github.com/repos/nodejs/node', {
  redirect: 'follow',
})
const data = await response.json()
```

By default, `safeFetchWrap` allows HTTPS on port 443, blocks private and reserved IP addresses and a list of forbidden domains, sets a 10-second timeout, and limits response bodies to 512 KiB. Destination checks also apply to redirects, and IP addresses are checked when connecting.

Pass `redirect` explicitly on each call: use `'follow'`, `'manual'`, or `'error'`. Configure the wrapper with options such as `timeout` (milliseconds), `responseMaxSize` (bytes), and `forbiddenDomainNames`. If you supply a custom `fetch`, it must honor Undici's `dispatcher` option; do not pass a separate dispatcher on individual calls.

## Other helpers

- `unicastFetchWrap()` restricts destinations to public IP addresses, including redirects, without adding the HTTPS, timeout, or response-size rules.
- `safeDispatchFetchWrap({ checkUrl, lookup })` lets you supply your own destination checks. `checkUrl` receives the origin of each request, including redirects, and returns a reason string to block it or `undefined` to allow it.
- `unicastLookup` checks DNS results before connecting. `isUnicastIpHostname(hostname)` checks a literal IP address and returns `undefined` for a domain name.
- This package also exports the helpers from `@atproto-labs/fetch` for working with requests, responses, errors, and fetch wrappers.

## Temporary eMudhra TLS mitigation

`emudhra-preload` blocks HTTPS connections that use any of the eight intermediate keys affected by the [eMudhra compromise](https://emudhra.we-have-a-problem.com/), as listed in [nodejs/node#66871](https://github.com/nodejs/node/pull/66871). It keeps the existing trusted roots, so other intermediates under those roots still work. Remove it once you deploy Node.js with the fix.

Node supports multiple `--import` flags. Load this before tracing and application code:

```sh
node --import=@atproto-labs/fetch-node/emudhra-preload --import=@atproto/pds/telemetry service.js
```

Or copy [`src/emudhra-preload.mjs`](src/emudhra-preload.mjs) into your image and load it directly. It needs no other files or packages:

```sh
node --import=/opt/mitigations/emudhra-preload.mjs --import=./tracing.mjs service.js
```

You can also add `--import=/opt/mitigations/emudhra-preload.mjs` to `NODE_OPTIONS`. Restart every process and discard any TLS sessions saved before the preload was installed. Resumed sessions skip the check.

The preload works with Node's HTTPS client, built-in `fetch()`, and Undici's standard connectors, including custom CAs and hostname checks. It wraps `tls.connect()` and adds the key check to the client's existing certificate check. Blocked connections fail with `CERT_REVOKED` before any HTTP request data is sent.

It checks keys during full TLS handshakes and caches up to 256 certificate results to avoid repeated work. Normal certificate validation still runs. Reusing a connection or resuming a checked session adds no key-check work.

Limits:

- Keep certificate verification enabled: do not set `rejectUnauthorized: false` or `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Clients must use `tls.connect()` after the preload runs. Other TLS libraries, direct `TLSSocket` use, and incoming client certificates are not covered. `--require` runs before `--import`, so avoid opening connections or saving a reference to `tls.connect` there.
- Workers and forked processes normally inherit the preload. Keep it enabled if you override `execArgv` or `NODE_OPTIONS`.
- A server can also be blocked if it sends an unused certificate with one of the eight keys. Unlike Node's native fix, this preload cannot check only the certificate path OpenSSL chose.
