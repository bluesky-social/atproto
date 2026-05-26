# quicklogin-client — Reference QuickLogin web client

A single-page HTML test client for the QuickLogin / W Identity flow. Hand-crafted, no build step — open `index.html` in a browser pointing at a PDS with QuickLogin enabled and walk through the auth flow.

## Use cases

- **Manual QA** of QuickLogin endpoints during development
- **Reference implementation** for partners integrating QuickLogin

## Don't confuse with

- `packages/oauth/oauth-client-browser-example/` — the upstream OAuth example, generic
- The real W Social client in `../../w-social-next-js/` — that's the production Expo app

## See also

- `.claude/docs/pds/quicklogin.md` — protocol spec + flow diagrams
