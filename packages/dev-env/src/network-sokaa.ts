import assert from 'node:assert'
import getPort from 'get-port'
import { wait } from '@atproto/common-web'
import { TestNetworkNoAppView } from './network-no-appview'
import { TestPds } from './pds'
import { TestPlc } from './plc'
import { TestSokaaAppView } from './sokaa-appview'
import { TestServerParams } from './types'
import { mockNetworkUtilities } from './util'

export class TestNetworkSokaa extends TestNetworkNoAppView {
  constructor(
    public plc: TestPlc,
    public pds: TestPds,
    public sokaa: TestSokaaAppView,
  ) {
    super(plc, pds)
  }

  static async create(
    params: Partial<TestServerParams> = {},
  ): Promise<TestNetworkSokaa> {
    const dbPostgresUrl = params.dbPostgresUrl || process.env.DB_POSTGRES_URL
    assert(dbPostgresUrl, 'Missing postgres url for Sokaa AppView tests')
    const dbPostgresSchema =
      params.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA || 'sokaa_e2e'

    const plc = await TestPlc.create(params.plc ?? {})
    const pdsPort = params.pds?.port ?? (await getPort())

    const sokaa = await TestSokaaAppView.create({
      plcUrl: plc.url,
      repoProvider: `ws://127.0.0.1:${pdsPort}`,
      dbPostgresUrl,
      dbPostgresSchema: `sokaa_${dbPostgresSchema}`,
      ...params.sokaa,
    })

    const pds = await TestPds.create({
      port: pdsPort,
      didPlcUrl: plc.url,
      sokaaAppViewUrl: sokaa.url,
      sokaaAppViewDid: sokaa.serverDid,
      ...params.pds,
    })

    mockNetworkUtilities(pds, undefined, sokaa)

    return new TestNetworkSokaa(plc, pds, sokaa)
  }

  async processFullSubscription(timeout = 5000) {
    const sub = this.sokaa.sub
    const start = Date.now()
    const lastSeq = await this.pds.ctx.sequencer.curr()
    if (!lastSeq) return
    while (Date.now() - start < timeout) {
      await sub.processAll()
      const runnerCursor = await sub.runner.getCursor()
      if (runnerCursor && runnerCursor >= lastSeq) {
        return
      }
      await wait(5)
    }
    throw new Error(`Sequence was not processed within ${timeout}ms`)
  }

  async processAll(timeout?: number) {
    await this.pds.processAll()
    await this.processFullSubscription(timeout)
  }

  async close() {
    await Promise.all(this.feedGens.map((fg) => fg.close()))
    await this.sokaa.close()
    await this.pds.close()
    await this.plc.close()
  }
}
