import AtpAgent from '@atproto/api'
import { SeedClient } from '../seeds/client'
import { TestNetwork } from '@atproto/dev-env'
import { forSnapshot } from '../_util'
import usersBulk from '../seeds/users-bulk'
import { chunkArray, DAY, wait } from '@atproto/common'
import { ids } from '@atproto/api/src/client/lexicons'
import { backfillRepos } from '../../src'

describe('repo subscription backfill', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let dids: string[]

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'subscription_backfill',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await wait(100) // allow pending sub to be established
    await network.bsky.sub.destroy()
    await usersBulk(sc, 50)

    // For consistent ordering
    dids = Object.keys(sc.dids)
      .sort()
      .map((handle) => sc.dids[handle])

    // Place all events out of the backfill period...
    await network.pds.ctx.db.db
      .updateTable('repo_seq')
      .set({
        sequencedAt: new Date(Date.now() - 2 * DAY).toISOString(),
      })
      .execute()
    // ...except one, which we should pick-up from.
    await updateProfile(pdsAgent, dids[0], { displayName: 'ping' })
    await network.pds.ctx.sequencerLeader.isCaughtUp()
  })

  afterAll(async () => {
    await network.close()
  })

  it('ingests all repos via backfill.', async () => {
    // Ensure no profiles have been indexed
    const profilesBefore = await getAllProfiles(agent, dids)
    expect(profilesBefore).toEqual([])

    await backfillRepos(network.bsky.ctx, 9)
    // Process backfill
    network.bsky.sub.resume()
    await network.processAll(60000)

    // Check all backfilled profiles
    const profilesAfter = await getAllProfiles(agent, dids)
    expect(dids).toEqual(profilesAfter.map((p) => p.did))
    expect(forSnapshot(profilesAfter)).toMatchSnapshot()
  })

  it('continues processing after backfill.', async () => {
    await updateProfile(pdsAgent, dids[0], { displayName: 'updated' })
    await network.processAll()
    const { data: profile } = await agent.api.app.bsky.actor.getProfile({
      actor: dids[0],
    })
    expect(profile.displayName).toEqual('updated')
  })

  async function getAllProfiles(agent: AtpAgent, dids: string[]) {
    const profileChunks = await Promise.all(
      chunkArray(dids, 25).map(async (chunk) => {
        const { data } = await agent.api.app.bsky.actor.getProfiles({
          actors: chunk,
        })
        return data.profiles
      }),
    )
    return profileChunks.flat()
  }

  async function updateProfile(
    agent: AtpAgent,
    did: string,
    record: Record<string, unknown>,
  ) {
    return await agent.api.com.atproto.repo.putRecord(
      {
        repo: did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record,
      },
      { headers: sc.getHeaders(did), encoding: 'application/json' },
    )
  }
})
