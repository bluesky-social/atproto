# dev-env

- Keep the temporary bootstrap PDS in `TestNetwork.create()` on localhost with FedCM disabled; the main PDS may advertise a public HTTPS hostname.
- `start:fedcm` runs ephemeral demo accounts behind `FEDCM_IDP_ORIGIN` on a PDS and PLC only (no AppView, so no Docker); keep it that way, and print browser URLs using the actual service configuration with `bsky_api_did=none`.
