import type { SkeletonHandler } from '@atproto/pds'
import { TestFeedGen } from './feed-gen.js'
import { TestPds } from './pds.js'
import { TestPlc } from './plc.js'
import { SeedClient } from './seed/client.js'
import type { TestServerParams } from './types.js'
import { mockNetworkUtilities } from './util.js'

export class TestNetworkNoAppView {
  feedGens: TestFeedGen[] = []
  constructor(
    public plc: TestPlc,
    public pds: TestPds,
  ) {}

  static async create(
    params: Partial<TestServerParams> = {},
  ): Promise<TestNetworkNoAppView> {
    const plc = await TestPlc.create(params.plc ?? {})
    const pds = await TestPds.create({
      didPlcUrl: plc.url,
      ...params.pds,
    })

    mockNetworkUtilities(pds)

    return new TestNetworkNoAppView(plc, pds)
  }

  async createFeedGen(
    feeds: Record<string, SkeletonHandler>,
  ): Promise<TestFeedGen> {
    const fg = await TestFeedGen.create(this.plc.url, feeds)
    this.feedGens.push(fg)
    return fg
  }

  getSeedClient(): SeedClient<typeof this> {
    const agent = this.pds.getAgent()
    const client = this.pds.getClient()
    return new SeedClient(this, agent, client)
  }

  async processAll() {
    await this.pds.processAll()
  }

  async close() {
    await Promise.all(this.feedGens.map((fg) => fg.close()))
    await this.pds.close()
    await this.plc.close()
  }
}
