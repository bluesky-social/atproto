import pkg from '@atproto/bsync/package.json' with { type: 'json' }
import { setup } from '@atproto-labs/opentelemetry-node'

setup(() => ({
  name: pkg.name,
  version: pkg.version,
}))
