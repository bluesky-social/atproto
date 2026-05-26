# packages/oauth/* — OAuth 2.1 stack for atproto

The OAuth 2.1 + DPoP implementation atproto uses. Powers the W Social PDS as an OAuth **provider** (issuing tokens for client apps) and supplies client SDKs for web, Node, browser, and Expo. **QuickLogin / W Identity sits on top of this stack** — see `.claude/docs/pds/quicklogin.md`.

## Subpackages

| Package | Role | Used by |
|---|---|---|
| `oauth-provider` | The provider runtime (login UI, token issuance, DPoP) | `@atproto/pds` |
| `oauth-provider-api` | HTTP layer of the provider | `oauth-provider` |
| `oauth-provider-frontend` | Login/consent UI app | `oauth-provider` |
| `oauth-provider-ui` | Reusable UI components for the provider screens | `oauth-provider-frontend` |
| `oauth-client` | Core client (framework-agnostic) | `oauth-client-*` flavours |
| `oauth-client-browser` | Browser SDK | Web client demos |
| `oauth-client-browser-example` | Reference web client | n/a |
| `oauth-client-expo` | React Native / Expo SDK | `../../w-social-next-js/` |
| `oauth-client-node` | Node SDK | Server-to-server flows |
| `oauth-types` | Shared TS types | All of the above |
| `oauth-scopes` | Scope definitions + parsing | provider + clients |
| `jwk` | JWK + JWKS helpers | provider |
| `jwk-jose` | JOSE-backed JWK implementation | Node provider |
| `jwk-webcrypto` | WebCrypto-backed JWK | Browser / Expo |

## W Social-specific bits

- **QuickLogin bridge** — `packages/pds/src/account-manager/helpers/quicklogin-oauth-bridge.ts` translates the W Identity QuickLogin flow into oauth-provider session state. The PDS's provider is otherwise stock.
- **DPoP enforcement** — required for all token use; we don't allow bearer-only clients.

## When to touch

- Adding a new scope → `oauth-scopes` (after coordinating with the W Identity team)
- Tweaking the login screen → `oauth-provider-frontend` / `oauth-provider-ui`
- Bug in token issuance → `oauth-provider`

## See also

- `.claude/docs/oauth/provider.md` — provider deep dive
- `.claude/docs/pds/quicklogin.md` — how QuickLogin layers on top
