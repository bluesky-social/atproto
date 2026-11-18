# OAuth browser example

This single-page app signs in with AT Protocol OAuth and displays the account profile, session, and token information. Run `pnpm dev` here and open <http://127.0.0.1:8080>.

Enter a handle to sign in, or configure FedCM to choose a remembered account first. With `scope=atproto` alone, selecting an account signs the user in from a verified FedCM token and no OAuth runs; with other scopes, the app then completes ordinary OAuth. Passive FedCM opens automatically; active FedCM waits for a click on **Choose an account**.

`pnpm dev` selects the `development` environment and local dev-env services. Only `env=development` selects local endpoint defaults; use the parameters below to target another stack.

## Query parameters

| Parameter                | Purpose                                                                                                                                                              | Default                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `env`                    | Selects environment-specific endpoint and scope defaults.                                                                                                            | Build mode, usually `development` with `pnpm dev`.                        |
| `pds_operator_url`       | PDS used by the **Login with…** button.                                                                                                                              | Development: `http://localhost:2583`; otherwise `https://bsky.social`.    |
| `plc_directory_url`      | PLC directory used to resolve DIDs.                                                                                                                                  | Development: `http://localhost:2582`; otherwise the OAuth client default. |
| `handle_resolver`        | Service used to resolve account handles.                                                                                                                             | Development: `http://localhost:2584`; otherwise `https://bsky.social`.    |
| `bsky_api_url`           | Bluesky API endpoint used by the example.                                                                                                                            | Development: `http://localhost:2584`; otherwise `https://api.bsky.app`.   |
| `bsky_api_did`           | Audience DID for Bluesky API OAuth permissions; `none` runs without an AppView (no profile card or Bluesky API permissions).                                         | Development: `did:example:invalid`; otherwise `did:web:api.bsky.app`.     |
| `scope`                  | Replaces environment-specific scopes; the app also requests `atproto` and the profile and preferences permissions it needs.                                          | Environment-specific scopes.                                              |
| `fedcm_provider`         | FedCM configuration URL; repeat to configure multiple identity providers. FedCM is off when omitted, unless `fedcm_idp_registration=true`.                           | None.                                                                     |
| `fedcm_idp_registration` | `true` also requests IdPs the browser registered via Chrome's experimental FedCM IdP Registration (type `https://atproto.com`); counts as one provider for `active`. | Off.                                                                      |
| `fedcm_mode`             | `passive` opens FedCM automatically; `active` adds a “Choose an account” button and requires exactly one provider.                                                   | `passive`.                                                                |

For a local AppView, set `bsky_api_did` to its actual DID. FedCM needs Chrome 141+ and an HTTPS PDS with the [prototype settings](../../pds/README.md#fedcm-prototype) enabled. For example, add `fedcm_provider=https://pds.example.com/oauth/fedcm/config.json&fedcm_mode=active` to the query string.

## Run the full FedCM example

This runs a local PDS and PLC directory with three test accounts. No Docker is needed. A Cloudflare tunnel gives the PDS the HTTPS address that FedCM requires, while the app stays on loopback.

The tunnel exposes a development PDS with known passwords. Keep its URL private and stop it when you're done.

**You need** Node 24, pnpm, [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (`brew install cloudflared`), and Chrome 141+.

**1. Build once** from the repository root:

```sh
pnpm install && pnpm build
```

**2. Start three processes** in separate terminals:

```sh
# Tunnel. Copy the https://….trycloudflare.com address it prints.
cloudflared tunnel --url http://localhost:2583

# PDS and PLC, using that address
cd packages/dev-env
FEDCM_IDP_ORIGIN=https://<your-tunnel>.trycloudflare.com pnpm start:fedcm

# Browser app
cd packages/oauth/oauth-client-browser-example
pnpm dev
```

The launcher prints the account manager URL and the app URLs: passive, active, and registered IdP, plus authentication-only (`scope=atproto`) versions of passive and registered IdP. Test accounts are `alice.test`, `bob.test`, and `carla.test`, all with password `hunter2`.

**3. Try FedCM with a configured provider.** This mode needs no Chrome flags.

1. Open the account manager URL (`<tunnel>/account`) and sign in. Check **Remember this account on this device**.
2. Open the passive URL, where the account picker appears on its own. Or open the active URL and click **Choose an account**.
3. Pick the account and approve. With the default scopes, the app verifies the token and then continues to OAuth. Add `scope=atproto` to the app URL to stop after verification and show an identity session (no OAuth, no tokens).

**4. Try registered IdP mode** (Chrome's experimental FedCM IdP Registration). In this mode the app doesn't name any PDS.

1. Enable both `chrome://flags/#fedcm-idp-registration` and `chrome://flags/#fedcm-lightweight-mode`, then relaunch Chrome. Without lightweight mode, the PDS registers but can't hand Chrome any accounts. You'll see `setStatus ... Overload resolution failed` in the PDS page's console.
2. Sign in on the PDS with **Remember this account on this device** checked. Either sign in at `<tunnel>/account`, or open the registered IdP URL and type the handle. Any PDS sign-in page registers the PDS with Chrome.
3. Open the registered IdP URL. Chrome offers the account. Pick it to sign in.
4. Optional: delete all cookies for the tunnel origin and retry. Chrome still offers the account, but the PDS refuses to sign without its device cookie, so the app shows an error. Sign in on the PDS again.

To remove the registration, clear site data for the tunnel origin.

**5. Optional: try multiple identity providers.** A second PDS, on its own tunnel and domain, shows several IdPs offering accounts in one FedCM prompt. Start a second tunnel, then start the launcher with both addresses:

```sh
# Second tunnel, to the second PDS's port
cloudflared tunnel --url http://localhost:2584

# Both PDSes share one PLC directory
cd packages/dev-env
FEDCM_IDP_ORIGIN=https://<tunnel-1>.trycloudflare.com \
FEDCM_IDP_ORIGIN_2=https://<tunnel-2>.trycloudflare.com \
pnpm start:fedcm
```

With two PDSes, each has its own handle domain, so that handles resolve across both. The first PDS's accounts are `alice.idp1.test`, `bob.idp1.test`, and `carla.idp1.test`. The second PDS's accounts are `dan.idp2.test` and `erin.idp2.test`. The password is still `hunter2`.

1. Sign in at each PDS's account manager (`<tunnel-1>/account`, `<tunnel-2>/account`) with **Remember this account on this device** checked.
2. Open the passive URL, which configures both PDSes as providers (two `fedcm_provider` parameters). Chrome lists accounts from both. Or, in registered IdP mode, open the registered IdP URL: signing in on each PDS registers both with Chrome.
3. Pick an account from either PDS. The app verifies a token signed by that account's key, and OAuth, if it runs, goes to that account's PDS.

Active mode takes exactly one provider, so the active URL uses only the first PDS.

**Notes**

- Each launcher run creates fresh accounts, so sign in again after a restart. A new tunnel needs a new `FEDCM_IDP_ORIGIN` (or `FEDCM_IDP_ORIGIN_2`).
- The demo has no AppView, so its URLs set `bsky_api_did=none` and the app skips the Bluesky profile card.
- If passive mode stays hidden after you dismiss it, use the active URL, and check Chrome's "Third-party sign-in" site setting.
- Firefox doesn't support this FedCM flow.

## Browser test

Build `oauth-provider-ui`, `oauth-provider`, `oauth-client-browser-example`, and `pds` from their package directories, then run from `packages/pds`:

```sh
PUPPETEER_EXECUTABLE_PATH='/path/to/chrome' pnpm test:sqlite tests/fedcm.test.ts tests/fedcm-idp-registration.test.ts --runInBand
```

`tests/fedcm-idp-registration.test.ts` covers the registered-IdP flow; it enables Chrome's `FedCmIdPRegistration` and `FedCmLightweightMode` features through launch args, so no `chrome://flags` setup is needed.
