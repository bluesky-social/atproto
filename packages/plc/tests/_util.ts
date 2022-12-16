import { AddressInfo } from 'net'
import PlcServer, { AppContext } from '../src/server'
import Database from '../src/server/db'

export type CloseFn = () => Promise<void>
export type TestServerInfo = {
  ctx: AppContext
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

  const plc = PlcServer.create({ db })
  const plcServer = await plc.start()
  const { port } = plcServer.address() as AddressInfo

  return {
    ctx: plc.ctx,
    url: `http://localhost:${port}`,
    close: async () => {
      await plc.destroy()
    },
  }
}
