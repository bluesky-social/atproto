import server from '../src/server'
import Database from '../src/server/db'

export type CloseFn = () => Promise<void>

export const runTestServer = async (opts: {
  port: number
  dbPostgresSchema: string
}): Promise<CloseFn> => {
  const { port, dbPostgresSchema } = opts
  const dbPostgresUrl = process.env.DB_POSTGRES_URL || undefined

  const db =
    dbPostgresUrl !== undefined
      ? await Database.postgres({
          url: dbPostgresUrl,
          schema: dbPostgresSchema,
        })
      : await Database.memory()

  await db.createTables()
  const s = server(db, port)
  return async () => {
    await db.close()
    s.close()
  }
}
