# dev-env

- Keep the temporary bootstrap PDS in `TestNetwork.create()` on localhost with FedCM disabled; the main PDS may advertise a public HTTPS hostname.
- `start:fedcm` runs ephemeral demo accounts behind `FEDCM_IDP_ORIGIN`. Give each run a unique PostgreSQL schema using letters and underscores only, and print browser URLs using the actual service configuration.
