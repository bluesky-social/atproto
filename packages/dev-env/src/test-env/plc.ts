import * as plc from '@did-plc/server'
import { PlcConfig, PlcServerInfo } from './types'
import { AddressInfo } from 'net'

export const runPlc = async (cfg: PlcConfig): Promise<PlcServerInfo> => {
  const db = plc.Database.mock()
  const server = plc.PlcServer.create({ db, ...cfg })
  const listener = await server.start()
  const port = (listener.address() as AddressInfo).port
  const url = `http://localhost:${port}`
  return {
    port,
    url,
    ctx: server.ctx,
    close: async () => {
      await server.destroy()
    },
  }
}
