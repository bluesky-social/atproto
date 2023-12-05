import { Handler as SkeletonHandler } from '@atproto/pds/src/lexicon/types/app/bsky/feed/getFeedSkeleton'
import { TestServerParams } from './types'
import { TestPlc } from './plc'
import { TestPds } from './pds'
import { mockNetworkUtilities } from './util'
import { TestFeedGen } from './feed-gen'
import { SeedClient } from './seed-client'

export class TestNetworkNoAppView {
  feedGens: TestFeedGen[] = []
  constructor(public plc: TestPlc, public pds: TestPds) {}

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

  getSeedClient(): SeedClient {
    const agent = this.pds.getClient()
    return new SeedClient(this, agent)
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
