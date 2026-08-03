import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import {
  REASONAPPEAL,
  REASONMISLEADING,
} from '../src/lexicon/types/com/atproto/moderation/defs.js'

describe('reporter status validation', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_reporter_status',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  const getCarolPostSubject = () => ({
    $type: 'com.atproto.repo.strongRef',
    uri: sc.posts[sc.dids.carol][0].ref.uriStr,
    cid: sc.posts[sc.dids.carol][0].ref.cidStr,
  })

  it('accepts reports from an account that has a takendown record', async () => {
    // Take down one of alice's posts, creating a record-level subject status
    // with takendown=true while her account remains in good standing
    await modClient.performTakedown({
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })

    await expect(
      sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: REASONMISLEADING,
        reason: 'lies!',
        subject: getCarolPostSubject(),
      }),
    ).resolves.toMatchObject({ reasonType: REASONMISLEADING })
  })

  it('accepts an appeal while another record has a pending appeal', async () => {
    // Appeal the record takedown from the previous test, leaving a pending
    // appeal on that record's subject status
    await expect(
      sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: REASONAPPEAL,
        reason: 'that takedown was wrong',
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.alice][0].ref.uriStr,
          cid: sc.posts[sc.dids.alice][0].ref.cidStr,
        },
      }),
    ).resolves.toMatchObject({ reasonType: REASONAPPEAL })

    // A pending appeal on one record must not block appealing another
    await modClient.performTakedown({
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][1].ref.uriStr,
        cid: sc.posts[sc.dids.alice][1].ref.cidStr,
      },
    })

    await expect(
      sc.createReport({
        reportedBy: sc.dids.alice,
        reasonType: REASONAPPEAL,
        reason: 'this one too',
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.alice][1].ref.uriStr,
          cid: sc.posts[sc.dids.alice][1].ref.cidStr,
        },
      }),
    ).resolves.toMatchObject({ reasonType: REASONAPPEAL })
  })

  it('rejects reports from a takendown account', async () => {
    await modClient.performTakedown({
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob,
      },
    })

    await expect(
      sc.createReport({
        reportedBy: sc.dids.bob,
        reasonType: REASONMISLEADING,
        reason: 'lies!',
        subject: getCarolPostSubject(),
      }),
    ).rejects.toMatchObject({
      error: 'AccountTakedown',
      message: 'Report not accepted from takendown account',
    })
  })
})
