import { TestServerParams } from './types'
import { TestPlc } from './plc'
import { TestPds } from './pds'
import { mockNetworkUtilities } from './util'

export class TestNetwork {
  constructor(public plc: TestPlc, public pds: TestPds) {}

  static async create(
    params: Partial<TestServerParams> = {},
  ): Promise<TestNetwork> {
    const dbPostgresUrl = params.dbPostgresUrl || process.env.DB_POSTGRES_URL
    const dbPostgresSchema =
      params.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA

    const plc = await TestPlc.create(params.plc ?? {})
    const pds = await TestPds.create({
      dbPostgresUrl,
      dbPostgresSchema,
      plcUrl: plc.url,
      ...params.pds,
    })
    mockNetworkUtilities(pds)

    return new TestNetwork(plc, pds)
  }

  async close() {
    await this.pds.close()
    await this.plc.close()
  }
}
