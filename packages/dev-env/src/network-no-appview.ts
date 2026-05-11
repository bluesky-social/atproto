import getPort from 'get-port'
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
    public extraPdses: TestPds[] = [],
  ) {}

  static async create(
    params: Partial<TestServerParams> = {},
  ): Promise<TestNetworkNoAppView> {
    const plc = await TestPlc.create(params.plc ?? {})
    const pds = await TestPds.create({
      didPlcUrl: plc.url,
      ...params.pds,
    })

    const extraPdsCount = params.extraPdses ?? 0
    const extraPdses: TestPds[] = []
    for (let i = 0; i < extraPdsCount; i++) {
      // Extra PDSes get their own non-overlapping handle domain (.test2, .test3, ...)
      // to avoid colliding with the primary PDS's .test.
      const domain = `.test${i + 2}`
      const extra = await TestPds.create({
        didPlcUrl: plc.url,
        ...params.pds,
        // Override after spreading so each extra PDS gets a unique port and
        // its own handle domain (rather than inheriting the primary's).
        port: await getPort(),
        serviceHandleDomains: [domain],
      })
      extraPdses.push(extra)
    }

    mockNetworkUtilities([pds, ...extraPdses])

    return new TestNetworkNoAppView(plc, pds, extraPdses)
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
    await Promise.all(this.extraPdses.map((p) => p.processAll()))
  }

  async close() {
    await Promise.all(this.feedGens.map((fg) => fg.close()))
    await this.pds.close()
    await Promise.all(this.extraPdses.map((p) => p.close()))
    await this.plc.close()
  }
}
