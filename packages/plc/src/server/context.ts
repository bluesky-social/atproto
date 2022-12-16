import { Database } from './db'

export class AppContext {
  constructor(
    private opts: {
      db: Database
      version: string
    },
  ) {}

  get db(): Database {
    return this.opts.db
  }

  get version(): string {
    return this.opts.version
  }
}

export default AppContext
