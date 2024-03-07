import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { BlobDiverter } from '../src/daemon'
import { forSnapshot } from './_util'

describe('blob divert', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_blob_divert_test',
      ozone: {
        blobReportServiceUrl: `https://blob-report.com`,
        blobReportServiceAuthToken: 'test-auth-token',
      },
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const mockReportServiceResponse = (result: boolean) => {
    return jest
      .spyOn(BlobDiverter.prototype, 'sendImage')
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
    agent.api.com.atproto.admin.emitModerationEvent(
      {
        subject: getSubject(),
        event: {
          $type: 'com.atproto.admin.defs#modEventDivert',
          comment: 'Diverting for test',
        },
        createdBy: sc.dids.alice,
        subjectBlobCids: sc.posts[sc.dids.carol][0].images.map((img) =>
          img.image.ref.toString(),
        ),
      },
      {
        headers: network.pds.adminAuthHeaders(),
        encoding: 'application/json',
      },
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

    const { data: divertEvent } = await emitDivertEvent()

    expect(reportServiceRequest).toHaveBeenCalled()
    expect(forSnapshot(divertEvent)).toMatchSnapshot()

    const {
      data: { subjectStatuses },
    } = await agent.api.com.atproto.admin.queryModerationStatuses(
      {
        subject: getSubject().uri,
      },
      {
        headers: network.pds.adminAuthHeaders(),
      },
    )

    expect(subjectStatuses[0].takendown).toBe(true)
  })
})
