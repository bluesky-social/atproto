import { AddressInfo } from 'net'
import server, { App } from '../src/server'
import Database from '../src/server/db'

export type CloseFn = () => Promise<void>
export type TestServerInfo = {
  app: App
  url: string
  close: CloseFn
}

export const runTestServer = async (opts: {
  dbPostgresSchema: string
}): Promise<TestServerInfo> => {
  const { dbPostgresSchema } = opts
  const dbPostgresUrl = process.env.DB_POSTGRES_URL || undefined

  const db =
    dbPostgresUrl !== undefined
      ? Database.postgres({
          url: dbPostgresUrl,
          schema: dbPostgresSchema,
        })
      : Database.memory()

  await db.migrateToLatestOrThrow()

  const { app, listener } = server(db)
  const { port } = listener.address() as AddressInfo

  return {
    app,
    url: `http://localhost:${port}`,
    close: async () => {
      await db.close()
      listener.close()
    },
  }
}
