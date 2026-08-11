import { type SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons.js'

describe('account preferences', () => {
  let network: TestNetwork
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_account_preferences_test',
    })
    sc = network.getSeedClient()
    await usersSeed(sc)
    // @NOTE TestNetwork migrates Ozone's DID after the PDS has cached it.
    await network.pds.ctx.didCache.clearEntry(network.ozone.ctx.cfg.service.did)
    await network.pds.getAgent().app.bsky.actor.putPreferences(
      {
        preferences: [
          {
            $type: 'app.bsky.actor.defs#adultContentPref',
            enabled: true,
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice) },
    )
  })

  afterAll(async () => {
    await network?.close()
  })

  it('returns preferences from the PDS', async () => {
    const url = new URL(
      '/xrpc/app.bsky.actor.getPreferences',
      network.ozone.url,
    )
    url.searchParams.set('did', sc.dids.alice)
    const res = await fetch(url, {
      headers: await network.ozone.modHeaders(ids.AppBskyActorGetPreferences),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      preferences: [
        {
          $type: 'app.bsky.actor.defs#adultContentPref',
          enabled: true,
        },
      ],
    })
  })
})
