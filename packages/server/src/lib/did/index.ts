import { ServerConfig } from '../../config'

export function resolve(did: string, cfg: ServerConfig) {
  if (did.startsWith('did:test:') && cfg.didTestRegistry) {
    return cfg.didTestRegistry.resolve(did)
  }
  throw new Error(`Unsupported did method: ${did}`)
}
