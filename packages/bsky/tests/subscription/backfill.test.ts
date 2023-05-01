import AtpAgent from '@atproto/api'
import { SeedClient } from '../seeds/client'
import { runTestEnv, TestEnvInfo } from '@atproto/dev-env'
import { forSnapshot, processAll } from '../_util'
import usersBulk from '../seeds/users-bulk'
import { chunkArray, DAY, wait } from '@atproto/common'
import { ids } from '@atproto/api/src/client/lexicons'

describe('repo subscription backfill', () => {
  let testEnv: TestEnvInfo
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let dids: string[]

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'subscription_backfill',
      bsky: { repoSubBackfillConcurrency: 15 },
    })
    agent = new AtpAgent({ service: testEnv.bsky.url })
    pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await wait(50) // allow pending sub to be established
    await testEnv.bsky.sub.destroy()
    await usersBulk(sc, 50)

    // For consistent ordering
    dids = Object.keys(sc.dids)
      .sort()
      .map((handle) => sc.dids[handle])

    // Place all events out of the backfill period...
    await testEnv.pds.ctx.db.db
      .updateTable('repo_seq')
      .set({
        sequencedAt: new Date(Date.now() - 2 * DAY).toISOString(),
      })
      .execute()
    // ...except one, which we should pick-up from.
    await updateProfile(pdsAgent, dids[0], { displayName: 'ping' })
  })

  afterAll(async () => {
    await testEnv.close()
  })

  it('ingests all repos via backfill.', async () => {
    // Ensure no profiles have been indexed
    const profilesBefore = await getAllProfiles(agent, dids)
    expect(profilesBefore).toEqual([])

    // Process backfill
    testEnv.bsky.sub.resume()
    await processAll(testEnv, 60000)

    // Check all backfilled profiles
    const profilesAfter = await getAllProfiles(agent, dids)
    expect(dids).toEqual(profilesAfter.map((p) => p.did))
    expect(forSnapshot(profilesAfter)).toMatchSnapshot()
  })

  it('continues processing after backfill.', async () => {
    await updateProfile(pdsAgent, dids[0], { displayName: 'updated' })
    await processAll(testEnv)
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
