export interface ServerConfigValues {
  debugMode?: boolean
  version: string

  publicUrl?: string
  scheme: string
  port?: number
  hostname: string

  dbPostgresUrl?: string
  dbPostgresSchema?: string

  jwtSecret: string

  didPlcUrl: string

  serverDid: string
  recoveryKey: string
  adminPassword: string

  inviteRequired: boolean

  blockstoreLocation?: string
  databaseLocation?: string

  availableUserDomains: string[]

  appUrlPasswordReset: string
  emailSmtpUrl?: string
  emailNoReplyAddress: string
}

export class ServerConfig {
  constructor(private cfg: ServerConfigValues) {
    const invalidDomain = cfg.availableUserDomains.find(
      (domain) => domain.length < 1 || !domain.startsWith('.'),
    )
    if (invalidDomain) {
      throw new Error(`Invalid domain: ${invalidDomain}`)
    }
  }

  static readEnv(overrides?: Partial<ServerConfigValues>) {
    const debugMode = process.env.DEBUG_MODE === '1'
    const version = process.env.PDS_VERSION || '0.0.0'

    const publicUrl = process.env.PUBLIC_URL || undefined
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

    const serverDid = overrides?.serverDid || process.env.SERVER_DID
    if (typeof serverDid !== 'string') {
      throw new Error('No value provided for process.env.SERVER_DID')
    }

    const recoveryKey = overrides?.recoveryKey || process.env.RECOVERY_KEY
    if (typeof recoveryKey !== 'string') {
      throw new Error('No value provided for process.env.RECOVERY_KEY')
    }

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin'

    const inviteRequired = process.env.INVITE_REQUIRED === 'true' ? true : false

    const blockstoreLocation = process.env.BLOCKSTORE_LOC
    const databaseLocation = process.env.DATABASE_LOC

    const availableUserDomains = process.env.AVAILABLE_USER_DOMAINS
      ? process.env.AVAILABLE_USER_DOMAINS.split(',')
      : []

    const appUrlPasswordReset =
      process.env.APP_URL_PASSWORD_RESET || 'app://password-reset'

    const emailSmtpUrl = process.env.EMAIL_SMTP_URL || undefined

    const emailNoReplyAddress =
      process.env.EMAIL_NO_REPLY_ADDRESS || 'noreply@blueskyweb.xyz'

    const dbPostgresUrl = process.env.DB_POSTGRES_URL
    const dbPostgresSchema = process.env.DB_POSTGRES_SCHEMA

    return new ServerConfig({
      debugMode,
      version,
      publicUrl,
      scheme,
      hostname,
      port,
      dbPostgresUrl,
      dbPostgresSchema,
      jwtSecret,
      recoveryKey,
      didPlcUrl,
      serverDid,
      adminPassword,
      inviteRequired,
      blockstoreLocation,
      databaseLocation,
      availableUserDomains,
      appUrlPasswordReset,
      emailSmtpUrl,
      emailNoReplyAddress,
      ...overrides,
    })
  }

  get debugMode() {
    return this.cfg.debugMode
  }

  get version() {
    return this.cfg.version
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

  get publicUrl() {
    return this.cfg.publicUrl || this.origin
  }

  get dbPostgresUrl() {
    return this.cfg.dbPostgresUrl
  }

  get dbPostgresSchema() {
    return this.cfg.dbPostgresSchema
  }

  get jwtSecret() {
    return this.cfg.jwtSecret
  }

  get didPlcUrl() {
    return this.cfg.didPlcUrl
  }

  get serverDid() {
    return this.cfg.recoveryKey
  }

  get recoveryKey() {
    return this.cfg.recoveryKey
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

  get availableUserDomains() {
    return this.cfg.availableUserDomains
  }

  get appUrlPasswordReset() {
    return this.cfg.appUrlPasswordReset
  }

  get emailSmtpUrl() {
    return this.cfg.emailSmtpUrl
  }

  get emailNoReplyAddress() {
    return this.cfg.emailNoReplyAddress
  }
}
