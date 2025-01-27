import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'

describe('get profiles through ozone', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_get_profiles',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('allows getting profiles by dids for takendown accounts.', async () => {
    const getProfiles = async (actors: string[]) => {
      const { data } = await modClient.agent.app.bsky.actor.getProfiles(
        { actors },
        {
          headers: await network.ozone.modHeaders(
            'app.bsky.actor.getProfiles',
            'admin',
          ),
        },
      )

      return data.profiles
    }
    const profilesBefore = await getProfiles([sc.dids.bob, sc.dids.carol])

    await modClient.performTakedown({
      subject: repoSubject(sc.dids.bob),
    })

    const profilesAfterFromOzone = await getProfiles([
      sc.dids.bob,
      sc.dids.carol,
    ])

    const appviewAgent = network.bsky.getClient()
    const {
      data: { profiles: profilesFromAppview },
    } = await appviewAgent.app.bsky.actor.getProfiles({
      actors: [sc.dids.bob, sc.dids.carol],
    })

    expect(profilesBefore.length).toEqual(profilesAfterFromOzone.length)
    expect(
      profilesAfterFromOzone.find((p) => p.did === sc.dids.bob),
    ).toBeTruthy()
    expect(profilesFromAppview.find((p) => p.did === sc.dids.bob)).toBeFalsy()
  })
})
