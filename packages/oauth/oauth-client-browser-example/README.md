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

## Run the full FedCM example

This setup runs a local PDS, PLC directory, AppView, and seeded accounts. A Cloudflare tunnel gives the PDS the HTTPS address Chrome needs. The browser app stays on loopback.

The tunnel exposes a development PDS with known test passwords, including its admin password. Use throwaway data, keep the tunnel URL private, and stop it when finished.

You need Node 24, pnpm, running Docker, `jq`, [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/), and Chrome 141+. Build once from the repository root:

```sh
pnpm install
pnpm build
```

In one terminal, start the tunnel and keep it running:

```sh
cloudflared tunnel --url http://localhost:2583
```

Copy the `https://….trycloudflare.com` address it prints. In a second terminal, start the services with that address:

```sh
cd packages/dev-env
FEDCM_IDP_ORIGIN=https://your-tunnel.trycloudflare.com pnpm start:fedcm
```

The launcher enables the PDS prototype settings, seeds accounts, and prints the account manager and configured passive and active example URLs. It uses ports 2581, 2582, 2583, 2584, and 2587, plus PostgreSQL on 5433 and Redis on 6380.

In a third terminal, start the browser app:

```sh
cd packages/oauth/oauth-client-browser-example
pnpm dev
```

In Chrome, open the printed account manager URL through the tunnel and click **Sign in**. Use `alice.test`, `bob.test`, or `carla.test` with password `hunter2` and enable **Remember this account on this device**. Sign in to more accounts there to populate the picker.

Open the printed passive URL to show the picker automatically, or the active URL and click **Choose an account**. Select an account and approve the OAuth permissions. The app then displays its profile and session.

If passive mode stays hidden after a dismissal, try the active URL and check Chrome's “Third-party sign-in” site permission. Firefox does not support this prototype's FedCM flow.

Stop the services with Ctrl+C, then stop the browser app and tunnel. The service wrapper removes PostgreSQL and Redis containers it started. If both were already running, it leaves them and the demo's PostgreSQL schemas in place. Each service run creates fresh accounts, so sign in again after restarting. A new tunnel also needs a new `FEDCM_IDP_ORIGIN` and the newly printed example URLs.

## Browser test

Build `oauth-provider-ui`, `oauth-provider`, `oauth-client-browser-example`, and `pds` from their package directories, then run from `packages/pds`:

```sh
PUPPETEER_EXECUTABLE_PATH='/path/to/chrome' pnpm test:sqlite tests/fedcm.test.ts --runInBand
```
