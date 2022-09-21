export interface ServerConfigValues {
  scheme: string
  port: number
  hostname: string

  blockstoreLocation?: string
  databaseLocation?: string
}

export class ServerConfig {
  constructor(private cfg: ServerConfigValues) {}

  static readEnv() {
    const hostname = process.env.HOSTNAME || 'localhost'
    let scheme
    if ('TLS' in process.env) {
      scheme = process.env.TLS === '1' ? 'https' : 'http'
    } else {
      scheme = hostname === 'localhost' ? 'http' : 'https'
    }
    const envPort = parseInt(process.env.PORT || '')
    const port = isNaN(envPort) ? 2583 : envPort

    const blockstoreLocation = process.env.BLOCKSTORE_LOC
    const databaseLocation = process.env.DATABASE_LOC

    return new ServerConfig({
      scheme,
      hostname,
      port,
      blockstoreLocation,
      databaseLocation,
    })
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
    const u = new URL('')
    u.protocol = 'http:'
    u.hostname = this.hostname
    u.port = String(this.port)
    return u.origin
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
}
