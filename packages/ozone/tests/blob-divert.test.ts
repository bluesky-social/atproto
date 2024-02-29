import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import nock from 'nock'

const BLOB_DIVERT_SERVICE_HOST = 'http://blob-report.com'
const BLOB_DIVERT_SERVICE_PATH = '/xrpc/com.atproto.unspecced.reportBlob'
const BLOB_DIVERT_SERVICE_AUTH_TOKEN = 'Basic test'

describe('blob divert', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_blob_divert_test',
      ozone: {
        blobReportServiceUrl: `${BLOB_DIVERT_SERVICE_HOST}${BLOB_DIVERT_SERVICE_PATH}`,
        blobReportServiceAuthToken: BLOB_DIVERT_SERVICE_AUTH_TOKEN,
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

  afterEach(() => {
    nock.cleanAll()
  })

  const mockReportServiceResponse = (
    status: number,
    data: Record<string, boolean>,
  ) =>
    nock(BLOB_DIVERT_SERVICE_HOST)
      .persist()
      .post(BLOB_DIVERT_SERVICE_PATH, () => true)
      .query(true)
      .reply(status, data)

  it('fails and keeps attempt count when report service fails to accept upload.', async () => {
    // Simulate failure to accept upload
    const reportServiceRequest = mockReportServiceResponse(401, {
      success: false,
    })

    await agent.api.com.atproto.admin.emitModerationEvent(
      {
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.carol][0].ref.uriStr,
          cid: sc.posts[sc.dids.carol][0].ref.cidStr,
        },
        event: {
          $type: 'com.atproto.admin.defs#modEventDivertBlobs',
          comment: 'Diverting for test',
        },
        createdBy: sc.dids.alice,
        subjectBlobCids: sc.posts[sc.dids.carol][0].images.map((img) =>
          img.image.ref.toString(),
        ),
      },
      { headers: network.pds.adminAuthHeaders(), encoding: 'application/json' },
    )

    await network.ozone.processAll()

    const divertEvents = await network.ozone.ctx.db.db
      .selectFrom('blob_divert_event')
      .selectAll()
      .execute()

    expect(divertEvents[0].attempts).toBeGreaterThan(0)
    expect(divertEvents[1].attempts).toBeGreaterThan(0)
    reportServiceRequest.done()
  })

  it('sends blobs to configured divert service and marks divert date', async () => {
    // Simulate failure to accept upload
    const reportServiceRequest = mockReportServiceResponse(200, {
      success: true,
    })

    await network.ozone.processAll()

    const divertEvents = await network.ozone.ctx.db.db
      .selectFrom('blob_divert_event')
      .selectAll()
      .execute()

    expect(divertEvents[0].divertedAt).toBeTruthy()
    expect(divertEvents[1].divertedAt).toBeTruthy()
    reportServiceRequest.done()
    reportServiceRequest.persist(false)
  })
})
