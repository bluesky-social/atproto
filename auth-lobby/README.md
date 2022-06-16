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

# Run Auth lobby
cd auth-lobby
yarn start

# (Optional) Run second Auth lobby to test device linking
cd auth-lobby
PORT=3002 yarn start

# Run example application
cd example-app
yarn start
```

### Use API

```typescript
import serveAuthLobby from '@adxp/auth-lobby'

const server = serveAuthLobby(/* port */3001)
server.on('error', /* ... */)
server.on('listening', /* ... */)
```
