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
      ? Database.postgres({
          url: dbPostgresUrl,
          schema: dbPostgresSchema,
        })
      : Database.memory()

  await db.migrateToLatestOrThrow()
  const s = server(db, port)
  return async () => {
    await db.close()
    s.close()
  }
}
