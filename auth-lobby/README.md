# ADX Auth Lobby

- Holds keys
- Signs device UCANs
- Signs application UCANs

### Run demo

```bash
# Install all packages from monorepo root
yarn

# Build all packages from monorepo root
yarn build

# Run ws-relay
cd ws-relay
yarn start

# Run Authenticated Auth lobby
cd auth-lobby
yarn start:authed

# Run Un-authenticated Auth lobby
cd auth-lobby
yarn start:unauthed

# Run example application
cd example-app
yarn start
```