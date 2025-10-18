import assert from 'node:assert'
import { ToolsOzoneModerationDefs } from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import { forSnapshot, identity } from './_util'

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

  const mockReportServiceResponse = (succeeds: boolean) => {
    const blobDiverter = network.ozone.ctx.blobDiverter
    assert(blobDiverter)
    return jest
      .spyOn(blobDiverter, 'uploadBlob')
      .mockImplementation(async () => {
        if (!succeeds) {
          // Using an XRPCError to trigger retries
          throw new XRPCError(ResponseType.Unknown, undefined)
        }
      })
  }

  const getSubject = () => ({
    $type: 'com.atproto.repo.strongRef',
    uri: sc.posts[sc.dids.carol][0].ref.uriStr,
    cid: sc.posts[sc.dids.carol][0].ref.cidStr,
  })

  const getImages = () => sc.posts[sc.dids.carol][0].images

  const emitDivertEvent = async () =>
    modClient.emitEvent(
      {
        subject: getSubject(),
        // @ts-expect-error "tools.ozone.moderation.defs#modEventDivert" is not part of the event open union
        event: identity<ToolsOzoneModerationDefs.ModEventDivert>({
          $type: 'tools.ozone.moderation.defs#modEventDivert',
          comment: 'Diverting for test',
        }),
        createdBy: sc.dids.alice,
        subjectBlobCids: getImages().map((img) => img.image.ref.toString()),
      },
      'moderator',
    )

  it('fails and keeps attempt count when report service fails to accept upload.', async () => {
    // Simulate failure to fail upload
    const reportServiceRequest = mockReportServiceResponse(false)
    try {
      await expect(emitDivertEvent()).rejects.toThrow('Failed to process blobs')

      // 1 initial attempt + 3 retries
      expect(reportServiceRequest).toHaveBeenCalledTimes(getImages().length * 4)
    } finally {
      reportServiceRequest.mockRestore()
    }
  })

  it('sends blobs to configured divert service and marks divert date', async () => {
    // Simulate success to accept upload
    const reportServiceRequest = mockReportServiceResponse(true)
    try {
      const divertEvent = await emitDivertEvent()

      expect(reportServiceRequest).toHaveBeenCalledTimes(getImages().length)
      expect(forSnapshot(divertEvent)).toMatchSnapshot()

      const { subjectStatuses } = await modClient.queryStatuses({
        subject: getSubject().uri,
      })

      expect(subjectStatuses[0].takendown).toBe(true)

      const event = await modClient.getEvent(divertEvent.id)
      expect(forSnapshot(event)).toMatchSnapshot()
    } finally {
      reportServiceRequest.mockRestore()
    }
  })
})
