import { DidTestRegistry } from './lib/did/did-test'

export interface ServerConfigValues {
  debugMode?: boolean

  scheme: string
  port: number
  hostname: string

  jwtSecret: string

  didPlcUrl: string
  serverDid: string

  blockstoreLocation?: string
  databaseLocation?: string

  didTestRegistry?: DidTestRegistry
}

export class ServerConfig {
  constructor(private cfg: ServerConfigValues) {}

  static readEnv() {
    const debugMode = process.env.DEBUG_MODE === '1'

    const hostname = process.env.HOSTNAME || 'localhost'
    let scheme
    if ('TLS' in process.env) {
      scheme = process.env.TLS === '1' ? 'https' : 'http'
    } else {
      scheme = hostname === 'localhost' ? 'http' : 'https'
    }
    const envPort = parseInt(process.env.PORT || '')
    const port = isNaN(envPort) ? 2583 : envPort

    const jwtSecret = process.env.JWT_SECRET || 'jwt_secret'

    const didPlcUrl = process.env.DID_PLC_URL || 'http://localhost:2582'
    const serverDid = process.env.SERVER_DID || ''

    const blockstoreLocation = process.env.BLOCKSTORE_LOC
    const databaseLocation = process.env.DATABASE_LOC

    const didTestRegistry = debugMode ? new DidTestRegistry() : undefined

    return new ServerConfig({
      debugMode,
      scheme,
      hostname,
      port,
      jwtSecret,
      serverDid,
      didPlcUrl,
      blockstoreLocation,
      databaseLocation,
      didTestRegistry,
    })
  }

  get debugMode() {
    return this.cfg.debugMode
  }

  get scheme() {
    return this.cfg.scheme
  }

  get port() {
    return this.cfg.port
  }

  get hostname() {
    return this.cfg.hostname
  }

  get origin() {
    const u = new URL(`${this.scheme}://${this.hostname}:${this.port}`)
    return u.origin
  }

  // @TODO should protect this better
  get jwtSecret() {
    return this.cfg.jwtSecret
  }

  get didPlcUrl() {
    return this.cfg.didPlcUrl
  }

  get serverDid() {
    return this.cfg.serverDid
  }

  get blockstoreLocation() {
    return this.cfg.blockstoreLocation
  }

  get useMemoryBlockstore() {
    return !this.blockstoreLocation
  }

  get databaseLocation() {
    return this.cfg.databaseLocation
  }

  get useMemoryDatabase() {
    return !this.databaseLocation
  }

  get didTestRegistry() {
    return this.cfg.didTestRegistry
  }
}
