# OAuth browser example

This single-page app signs in with AT Protocol OAuth and displays the account profile, session, and token information. Run `pnpm dev` here and open <http://127.0.0.1:8080>.

Enter a handle to sign in, or configure FedCM to choose a remembered account first. After selection, the app completes ordinary OAuth. Passive FedCM opens automatically; active FedCM waits for a click on **Choose an account**.

`pnpm dev` selects the `development` environment and local dev-env services. Only `env=development` selects local endpoint defaults; use the parameters below to target another stack.

## Query parameters

| Parameter           | Purpose                                                                                                                     | Default                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `env`               | Selects environment-specific endpoint and scope defaults.                                                                   | Build mode, usually `development` with `pnpm dev`.                        |
| `pds_operator_url`  | PDS used by the **Login with…** button.                                                                                     | Development: `http://localhost:2583`; otherwise `https://bsky.social`.    |
| `plc_directory_url` | PLC directory used to resolve DIDs.                                                                                         | Development: `http://localhost:2582`; otherwise the OAuth client default. |
| `handle_resolver`   | Service used to resolve account handles.                                                                                    | Development: `http://localhost:2584`; otherwise `https://bsky.social`.    |
| `bsky_api_url`      | Bluesky API endpoint used by the example.                                                                                   | Development: `http://localhost:2584`; otherwise `https://api.bsky.app`.   |
| `bsky_api_did`      | Audience DID for Bluesky API OAuth permissions.                                                                             | Development: `did:example:invalid`; otherwise `did:web:api.bsky.app`.     |
| `scope`             | Replaces environment-specific scopes; the app also requests `atproto` and the profile and preferences permissions it needs. | Environment-specific scopes.                                              |
| `fedcm_provider`    | FedCM configuration URL; repeat to configure multiple identity providers. FedCM is off when omitted.                        | None.                                                                     |
| `fedcm_mode`        | `passive` opens FedCM automatically; `active` adds a “Choose an account” button and requires exactly one provider.          | `passive`.                                                                |

For a local AppView, set `bsky_api_did` to its actual DID. FedCM needs Chrome 141+ and an HTTPS PDS with the [prototype settings](../../pds/README.md#fedcm-prototype) enabled. For example, add `fedcm_provider=https://pds.example.com/oauth/fedcm/config.json&fedcm_mode=active` to the query string.

## Browser test

Build `oauth-provider-ui`, `oauth-provider`, `oauth-client-browser-example`, and `pds` from their package directories, then run from `packages/pds`:

```sh
PUPPETEER_EXECUTABLE_PATH='/path/to/chrome' pnpm test:sqlite tests/fedcm.test.ts --runInBand
```
