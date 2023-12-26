import assert from 'assert'

export interface DaemonConfigValues {
  version: string
  dbPostgresUrl: string
  dbPostgresSchema?: string
  serverDid: string
  appviewUrl: string
  appviewDid?: string
  pdsUrl?: string
  pdsDid?: string
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
    const serverDid = overrides?.serverDid || process.env.SERVER_DID
    assert(serverDid)
    const appviewUrl = overrides?.appviewUrl || process.env.APPVIEW_URL
    assert(appviewUrl)
    const appviewDid = process.env.APPVIEW_DID
    const pdsUrl = process.env.PDS_URL
    const pdsDid = process.env.PDS_DID

    return new DaemonConfig({
      version,
      dbPostgresUrl,
      dbPostgresSchema,
      serverDid,
      appviewUrl,
      appviewDid,
      pdsUrl,
      pdsDid,
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

  get serverDid() {
    return this.cfg.serverDid
  }

  get appviewUrl() {
    return this.cfg.appviewUrl
  }

  get appviewDid() {
    return this.cfg.appviewDid
  }

  get pdsUrl() {
    return this.cfg.pdsUrl
  }

  get pdsDid() {
    return this.cfg.pdsDid
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
