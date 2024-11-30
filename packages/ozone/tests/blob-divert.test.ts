import assert from 'node:assert'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { forSnapshot } from './_util'

describe('blob divert', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_blob_divert_test',
      ozone: {
        blobDivertUrl: `https://blob-report.com`,
        blobDivertAdminPassword: 'test-auth-token',
      },
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const mockReportServiceResponse = (result: boolean) => {
    const blobDiverter = network.ozone.ctx.blobDiverter
    assert(blobDiverter)
    return jest
      .spyOn(blobDiverter, 'sendImage')
      .mockImplementation(async () => {
        return result
      })
  }

  const getSubject = () => ({
    $type: 'com.atproto.repo.strongRef',
    uri: sc.posts[sc.dids.carol][0].ref.uriStr,
    cid: sc.posts[sc.dids.carol][0].ref.cidStr,
  })

  const emitDivertEvent = async () =>
    modClient.emitEvent(
      {
        subject: getSubject(),
        event: {
          $type: 'tools.ozone.moderation.defs#modEventDivert',
          comment: 'Diverting for test',
        },
        createdBy: sc.dids.alice,
        subjectBlobCids: sc.posts[sc.dids.carol][0].images.map((img) =>
          img.image.ref.toString(),
        ),
      },
      'moderator',
    )

  it('fails and keeps attempt count when report service fails to accept upload.', async () => {
    // Simulate failure to fail upload
    const reportServiceRequest = mockReportServiceResponse(false)

    await expect(emitDivertEvent()).rejects.toThrow()

    expect(reportServiceRequest).toHaveBeenCalled()
  })

  it('sends blobs to configured divert service and marks divert date', async () => {
    // Simulate failure to accept upload
    const reportServiceRequest = mockReportServiceResponse(true)

    const divertEvent = await emitDivertEvent()

    expect(reportServiceRequest).toHaveBeenCalled()
    expect(forSnapshot(divertEvent)).toMatchSnapshot()

    const { subjectStatuses } = await modClient.queryStatuses({
      subject: getSubject().uri,
    })

    expect(subjectStatuses[0].takendown).toBe(true)
  })
})
