export interface ServerConfigValues {
  debugMode?: boolean

  scheme: string
  port: number
  hostname: string

  jwtSecret: string

  didPlcUrl: string
  serverDid: string

  adminPassword: string

  inviteRequired: boolean

  blockstoreLocation?: string
  databaseLocation?: string

  testNameRegistry?: Record<string, string>
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
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin'

    const inviteRequired = process.env.INVITE_REQUIRED === 'true' ? true : false

    const blockstoreLocation = process.env.BLOCKSTORE_LOC
    const databaseLocation = process.env.DATABASE_LOC

    const testNameRegistry = debugMode ? {} : undefined

    return new ServerConfig({
      debugMode,
      scheme,
      hostname,
      port,
      jwtSecret,
      serverDid,
      didPlcUrl,
      adminPassword,
      inviteRequired,
      blockstoreLocation,
      databaseLocation,
      testNameRegistry,
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

  get adminPassword() {
    return this.cfg.adminPassword
  }

  get inviteRequired() {
    return this.cfg.inviteRequired
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

  get testNameRegistry() {
    return this.cfg.testNameRegistry
  }
}
