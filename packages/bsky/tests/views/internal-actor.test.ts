import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppBskyActorDefs, AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { knownFollowersSeed } from '../seed/known-followers.js'

describe('internal actor views', () => {
  let network: TestNetwork
  let pdsAgent: AtpAgent
  let seedClient: SeedClient

  let dids: Record<string, DidString>

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_internal_actor',
    })
    pdsAgent = network.pds.getAgent()
    seedClient = network.getSeedClient()

    await knownFollowersSeed(seedClient)

    dids = seedClient.dids

    /*
     * Mix of blocks and non, mirroring the known-followers test setup so the
     * social proof results exercise block filtering too.
     */
    await pdsAgent.api.app.bsky.graph.block.create(
      { repo: dids.mix_view },
      { createdAt: new Date().toISOString(), subject: dids.mix_fp_block_res },
      seedClient.getHeaders(dids.mix_view),
    )
    await pdsAgent.api.app.bsky.graph.block.create(
      { repo: dids.mix_sub_1 },
      { createdAt: new Date().toISOString(), subject: dids.mix_sp_block_res },
      seedClient.getHeaders(dids.mix_sub_1),
    )
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  describe('getProfiles', () => {
    const getProfiles = async (
      params: { dids: string[]; socialProof?: string[]; viewer?: string },
      headers: Record<string, string> = network.bsky.adminAuthHeaders(),
    ) => {
      const search = new URLSearchParams()
      params.dids.forEach((did) => search.append('dids', did))
      params.socialProof?.forEach((did) => search.append('socialProof', did))
      if (params.viewer) search.append('viewer', params.viewer)
      const res = await fetch(
        `${network.bsky.url}/xrpc/internal.bsky.actor.getProfiles?${search.toString()}`,
        { headers },
      )
      return {
        status: res.status,
        body: (await res.json()) as {
          profiles: AppBskyActorDefs.ProfileViewDetailed[]
        },
      }
    }

    it('requires role auth, rejecting standard user auth', async () => {
      const userHeaders = await network.serviceHeaders(
        dids.mix_view,
        'internal.bsky.actor.getProfiles',
      )
      const { status } = await getProfiles(
        { dids: [dids.mix_sub_1] },
        userHeaders,
      )
      expect(status).toBe(401)
    })

    it('returns all profiles, with social proof only for the requested subset', async () => {
      const { status, body } = await getProfiles({
        dids: [dids.mix_sub_1, dids.mix_sub_2, dids.mix_sub_3],
        socialProof: [dids.mix_sub_1],
        viewer: dids.mix_view,
      })
      expect(status).toBe(200)
      expect(body.profiles).toHaveLength(3)

      const [sub_1, sub_2, sub_3] = body.profiles
      expect(sub_1.viewer?.knownFollowers?.count).toBe(3)
      expect(sub_1.viewer?.knownFollowers?.followers).toHaveLength(1)
      expect(sub_2.viewer?.knownFollowers).toBeUndefined()
      expect(sub_3.viewer?.knownFollowers).toBeUndefined()
    })

    it('ignores socialProof dids that are not in dids', async () => {
      const { status, body } = await getProfiles({
        dids: [dids.mix_sub_1],
        socialProof: [dids.mix_sub_1, dids.mix_sub_2],
        viewer: dids.mix_view,
      })
      expect(status).toBe(200)
      expect(body.profiles).toHaveLength(1)
      expect(body.profiles[0].did).toBe(dids.mix_sub_1)
      expect(body.profiles[0].viewer?.knownFollowers?.count).toBe(3)
    })

    it('returns no social proof when socialProof is omitted', async () => {
      const { status, body } = await getProfiles({
        dids: [dids.mix_sub_1, dids.mix_sub_2],
        viewer: dids.mix_view,
      })
      expect(status).toBe(200)
      expect(body.profiles).toHaveLength(2)
      for (const profile of body.profiles) {
        expect(profile.viewer?.knownFollowers).toBeUndefined()
      }
    })

    it('returns no viewer state when viewer is omitted', async () => {
      const { status, body } = await getProfiles({
        dids: [dids.mix_sub_1],
        socialProof: [dids.mix_sub_1],
      })
      expect(status).toBe(200)
      expect(body.profiles).toHaveLength(1)
      expect(body.profiles[0].viewer).toBeUndefined()
    })
  })
})
