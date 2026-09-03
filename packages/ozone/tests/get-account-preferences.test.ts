import { type SeedClient, TestNetwork, usersSeed } from '@atproto/dev-env'
import type { Client } from '@atproto/lex'
import { app, tools } from '../src/lexicons/index.js'

// @TODO In order to properly test this, Ozone and the user should be on
// different PDS instances.
describe('account preferences', () => {
  let network: TestNetwork
  let sc: SeedClient
  let client: Client

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_account_preferences_test',
    })
    sc = network.getSeedClient()
    client = network.ozone.getClient()
    await usersSeed(sc)
    // @NOTE TestNetwork migrates Ozone's DID after the PDS has cached it.
    await network.pds.ctx.didCache.clearEntry(network.ozone.ctx.cfg.service.did)
    await network.pds.getClient().call(
      app.bsky.actor.putPreferences,
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
    const data = await client.call(
      tools.ozone.moderation.getAccountPreferences,
      { did: sc.dids.alice },
      {
        headers: await network.ozone.modHeaders(
          tools.ozone.moderation.getAccountPreferences.$lxm,
        ),
      },
    )

    expect(data).toEqual({
      preferences: [
        {
          $type: 'app.bsky.actor.defs#adultContentPref',
          enabled: true,
        },
      ],
    })
  })
})
