# examples/ — Demo apps

Standalone demo applications. Not built, tested, or deployed as part of the main pipeline — they're for documentation and partner integration reference.

## Current examples

- `remotelogin/` — minimal RemoteLogin (Neuro) demo client

## Conventions

- Each example is self-contained with its own `README.md`
- No imports from `packages/*` at relative paths — pretend you're an external consumer; use the published-style import
- Don't put production logic here

If a demo starts being useful as a real internal tool, promote it out of `examples/` and give it a proper home.
