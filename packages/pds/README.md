# @atproto/pds: Personal Data Server (PDS)

TypeScript reference implementation of an atproto PDS.

[![NPM](https://img.shields.io/npm/v/@atproto/pds)](https://www.npmjs.com/package/@atproto/pds)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

If you are interested in self-hosting a PDS, you probably want this repository instead, which has a thin service wrapper, documentation, a Dockerfile, etc: https://github.com/bluesky-social/pds

## FedCM prototype

Set `PDS_OAUTH_FEDCM_ENABLED=1` on an HTTPS PDS to offer a browser account picker. It shows remembered accounts with active sessions and returns the selected DID. Apps must still complete AT Protocol OAuth to sign in.

The configuration URL is `/oauth/fedcm/config.json`. For `pds.example.com`, also publish the `/.well-known/web-identity` document at `https://example.com`. PDS hosts behind an entryway must enable FedCM at the entryway's authorization server instead.

Production requires a discoverable HTTPS OAuth client ID whose origin matches the relying party. For the local browser example, set `PDS_OAUTH_FEDCM_ALLOW_LOOPBACK_CLIENTS=1` and `PDS_DEV_MODE=1`; the PDS must still use HTTPS.

Remembered sessions use dedicated `fedcm-dev-id` and `fedcm-ses-id` cookies containing the existing session values, with `Secure`, `HttpOnly`, `SameSite=None`, and `Path=/oauth/fedcm`. FedCM endpoints only read sessions and do not create or rotate them. Ordinary device cookies keep their `SameSite=Lax` or `Strict` policy.

See the [browser example instructions](../oauth/oauth-client-browser-example/README.md) for local validation. Chrome 141+ is required for username-only accounts; browser settings may hide the chooser, so relying parties should retain handle entry.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
