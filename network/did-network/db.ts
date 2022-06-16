import knex, { Knex } from 'knex'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KnexDB = Knex<any, unknown[]>
export type DidInfo = {
  username: string
  signingKey: string
}

const TABLE = {
  name: 'did_network',
  create: (table: Knex.CreateTableBuilder) => {
    table.string('did').primary()
    table.string('username')
    table.string('host')
    table.string('signingKey')
    table.unique(['username, host'])
  },
}

export class Database {
  private db: KnexDB

  constructor(db: KnexDB) {
    this.db = db
  }

  static sqlite(location: string): Database {
    const db = knex({
      client: 'sqlite3',
      connection: {
        filename: location,
      },
    })
    return new Database(db)
  }

  static memory(): Database {
    return Database.sqlite(':memory:')
  }

  async createTables(): Promise<void> {
    const exists = await this.db.schema.hasTable(TABLE.name)
    if (exists) return
    await this.db.schema.createTable(TABLE.name, TABLE.create)
  }

  async dropTables(): Promise<void> {
    await this.db.schema.dropTableIfExists(TABLE.name)
  }

  // DID NETWORK
  // -----------

  async register(
    username: string,
    did: string,
    host: string,
    signingKey: string,
  ): Promise<void> {
    await this.db
      .insert({ username, did, host, signingKey })
      .into('did_network')
  }

  async getInfo(did: string): Promise<DidInfo | null> {
    const row = await this.db.select('*').from('did_network').where({ did })
    if (row.length < 1) return null
    const username = `${row[0].username}@${row[0].host}`
    const signingKey = row[0].signingKey
    return { username, signingKey }
  }
}

export default Database
