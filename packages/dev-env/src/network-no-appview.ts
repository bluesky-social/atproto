import { SkeletonHandler } from '@atproto/pds'
import { TestFeedGen } from './feed-gen'
import { TestPds } from './pds'
import { TestPlc } from './plc'
import { SeedClient } from './seed/client'
import { TestServerParams } from './types'
import { mockNetworkUtilities } from './util'

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
    const agent = this.pds.getClient()
    return new SeedClient(this, agent)
  }

  async processAll() {
    await this.pds.processAll()
  }

  async close() {
    await Promise.all(this.feedGens.map((fg) => fg.close()))
    // Cleanup Neuro managers to clear timeouts and event listeners
    if (this.pds.ctx.neuroAuthManager) {
      this.pds.ctx.neuroAuthManager.cleanup?.()
    }
    if (this.pds.ctx.neuroRemoteLoginManager) {
      this.pds.ctx.neuroRemoteLoginManager.cleanup?.()
    }
    await this.pds.close()
    await this.plc.close()
  }
}
