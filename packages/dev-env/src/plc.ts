import { Client as PlcClient } from '@did-plc/lib'
import * as plc from '@did-plc/server'
import { PlcConfig } from './types'
import { AddressInfo } from 'net'

export class TestPlc {
  constructor(
    public url: string,
    public port: number,
    public server: plc.PlcServer,
  ) {}

  static async create(cfg: PlcConfig): Promise<TestPlc> {
    const db = plc.Database.mock()
    const server = plc.PlcServer.create({ db, ...cfg })
    const listener = await server.start()
    const port = (listener.address() as AddressInfo).port
    const url = `http://localhost:${port}`
    return new TestPlc(url, port, server)
  }

  get ctx(): plc.AppContext {
    return this.server.ctx
  }

  getClient(): PlcClient {
    return new PlcClient(this.url)
  }

  async close() {
    await this.server.destroy
  }
}
