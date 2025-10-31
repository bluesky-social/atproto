import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'

describe('revoke account credentials event', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_revoke_account_credentials',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('fails on non account subjects and for non admins', async () => {
    await expect(
      modClient.emitEvent({
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.alice][0].ref.uriStr,
          cid: sc.posts[sc.dids.alice][0].ref.cidStr,
        },
        event: {
          $type: 'tools.ozone.moderation.defs#revokeAccountCredentialsEvent',
          comment: 'user was hacked',
        },
      }),
    ).rejects.toThrow('Invalid subject type')
    await expect(
      modClient.emitEvent({
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice,
        },
        event: {
          $type: 'tools.ozone.moderation.defs#revokeAccountCredentialsEvent',
          comment: 'user was hacked',
        },
      }),
    ).rejects.toThrow('Must be an admin to revoke account credentials')
  })
})
