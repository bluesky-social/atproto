import getPort from 'get-port'
import type { SkeletonHandler } from '@atproto/pds'
import { TestFeedGen } from './feed-gen.js'
import { TestPds } from './pds.js'
import { TestPlc } from './plc.js'
import { SeedClient } from './seed/client.js'
import { LexiconAuthorityProfile } from './service-profile-lexicon.js'
import type { TestServerParams } from './types.js'
import { mockNetworkUtilities } from './util.js'

export class TestNetworkNoAppView {
  feedGens: TestFeedGen[] = []
  constructor(
    public plc: TestPlc,
    public pds: TestPds,
    public extraPdses: TestPds[] = [],
    public lexiconAuthority?: LexiconAuthorityProfile,
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

    let lexiconAuthority: LexiconAuthorityProfile | undefined
    if (params.lexiconAuthority) {
      // The authority account has to live on a PDS, but a PDS wants the authority
      // DID in its config — so it's created after boot and the DID assigned here.
      // The resolver hook reads `cfg.lexicon.didAuthority` per call rather than at
      // construction (see pds `context.ts`), so assigning it now takes effect.
      lexiconAuthority = await LexiconAuthorityProfile.create(pds)
      for (const each of [pds, ...extraPdses]) {
        each.ctx.cfg.lexicon.didAuthority = lexiconAuthority.did
      }
      await lexiconAuthority.createRecords()
    }

    return new TestNetworkNoAppView(plc, pds, extraPdses, lexiconAuthority)
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
