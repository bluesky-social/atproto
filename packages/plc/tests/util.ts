import server from '../src/server'
import Database from '../src/server/db'

export type CloseFn = () => Promise<void>

export const runTestServer = async (port: number): Promise<CloseFn> => {
  const db = await Database.memory()
  const s = server(db, port)
  return async () => {
    await db.close()
    s.close()
  }
}
