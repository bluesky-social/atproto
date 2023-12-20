import assert from 'assert'

export interface DaemonConfigValues {
  version: string
  dbPostgresUrl: string
  dbPostgresSchema?: string
  appviewUrl: string
  adminPassword: string
}

export class DaemonConfig {
  constructor(private cfg: DaemonConfigValues) {}

  static readEnv(overrides?: Partial<DaemonConfigValues>) {
    const version = process.env.BSKY_VERSION || '0.0.0'
    const dbPostgresUrl =
      overrides?.dbPostgresUrl || process.env.DB_PRIMARY_POSTGRES_URL
    const dbPostgresSchema =
      overrides?.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA
    assert(dbPostgresUrl)
    const appviewUrl = overrides?.appviewUrl || process.env.APPVIEW_URL
    assert(appviewUrl)
    const adminPassword = overrides?.adminPassword || process.env.ADMIN_PASSWORD
    assert(adminPassword)
    return new DaemonConfig({
      version,
      dbPostgresUrl,
      dbPostgresSchema,
      appviewUrl,
      adminPassword,
      ...stripUndefineds(overrides ?? {}),
    })
  }

  get version() {
    return this.cfg.version
  }

  get dbPostgresUrl() {
    return this.cfg.dbPostgresUrl
  }

  get dbPostgresSchema() {
    return this.cfg.dbPostgresSchema
  }

  get appviewUrl() {
    return this.cfg.appviewUrl
  }

  get adminPassword() {
    return this.cfg.adminPassword
  }
}

function stripUndefineds(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result = {}
  Object.entries(obj).forEach(([key, val]) => {
    if (val !== undefined) {
      result[key] = val
    }
  })
  return result
}
