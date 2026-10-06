# @atproto/pds: Personal Data Server (PDS)

TypeScript reference implementation of an atproto PDS.

[![NPM](https://img.shields.io/npm/v/@atproto/pds)](https://www.npmjs.com/package/@atproto/pds)
[![Github CI Status](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml/badge.svg)](https://github.com/bluesky-social/atproto/actions/workflows/repo.yaml)

If you are interested in self-hosting a PDS, you probably want this repository instead, which has a thin service wrapper, documentation, a Dockerfile, etc: https://github.com/bluesky-social/pds

## FedCM prototype

Set `PDS_OAUTH_FEDCM_ENABLED=1` to enable account-first FedCM on an HTTPS
PDS. The browser chooser lists eligible accounts remembered on that device and
returns the selected DID. The DID is a routing hint: the relying party resolves
it and starts ordinary AT Protocol OAuth, including PAR, PKCE, DPoP, and consent.
FedCM selection alone does not authenticate the application or authorize access.

The PDS serves `/.well-known/web-identity`, `/oauth/fedcm/config.json`,
`/oauth/fedcm/accounts`, and `/oauth/fedcm/assertion`. Chrome also discovers the
well-known document at the registrable parent domain. For `pds.example.com`,
the operator must publish the discovery document at `https://example.com` too.
Enabling this flag cannot provision that parent domain. Multiple independent
PDSes under one registrable domain need a shared discovery/deployment design.
Entryway-backed PDSes must implement FedCM at the entryway's authorization-server
origin; enabling it on those PDSes is rejected.

Production assertions require a discoverable HTTPS OAuth client ID whose origin
matches the relying party. For the local browser example, enable
`PDS_OAUTH_FEDCM_ALLOW_LOOPBACK_CLIENTS=1` together with `PDS_DEV_MODE=1`. This
permits validated loopback client metadata and checks the relying party's origin
against its loopback redirect URI. HTTPS is still required for the provider.

Remembered first-party sessions issue dedicated Secure, HttpOnly, SameSite=None
cookies scoped to `/oauth/fedcm`. FedCM reads never create or rotate sessions;
expired, revoked, deactivated, or taken-down accounts are excluded. First-party
account and OAuth pages update the browser's login status. The FedCM sign-in
window defaults to remembering the account and closes after a persisted login
or an explicit choice of an eligible remembered account. Unchecked ephemeral
sign-ins remain outside the chooser.

These cookies mirror the existing device and rotating session IDs, using the
same server-side session. They are separate because FedCM's cross-site accounts
and assertion requests include only `SameSite=None` cookies, while ordinary
device cookies retain `SameSite=Lax` or `Strict`. Dedicated names and the narrow
path keep those cookie policies separate without changing ordinary sign-in.

See the [browser example instructions](../oauth/oauth-client-browser-example/README.md)
for passive multi-provider selection and local browser validation. This prototype
requires Chrome 141+ for username-only accounts; browser support and privacy
settings can suppress the chooser, so relying parties should retain handle entry.

## License

This project is dual-licensed under MIT and Apache 2.0 terms:

- MIT license ([LICENSE-MIT.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-MIT.txt) or http://opensource.org/licenses/MIT)
- Apache License, Version 2.0, ([LICENSE-APACHE.txt](https://github.com/bluesky-social/atproto/blob/main/LICENSE-APACHE.txt) or http://www.apache.org/licenses/LICENSE-2.0)

Downstream projects and end users may chose either license individually, or both together, at their discretion. The motivation for this dual-licensing is the additional software patent assurance provided by Apache 2.0.
