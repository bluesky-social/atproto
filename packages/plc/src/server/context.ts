import { Database } from './db'

export class AppContext {
  constructor(
    private opts: {
      db: Database
      version: string
      port?: number
    },
  ) {}

  get db() {
    return this.opts.db
  }

  get version() {
    return this.opts.version
  }

  get port() {
    return this.opts.port
  }
}

export default AppContext
