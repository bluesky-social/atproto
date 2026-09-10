import pkg from '@atproto/bsky/package.json' with { type: 'json' }
import { setup } from '@atproto-labs/opentelemetry-node'

await setup(() => ({
  name: pkg.name,
  version: pkg.version,
}))
