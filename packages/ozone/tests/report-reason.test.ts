import { jest } from '@jest/globals'
import type AtpAgent from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { app, com, tools } from '../src/lexicons/index.js'
import { ModerationServiceProfile } from '../src/mod-service/profile.js'
import { forSnapshot } from './_util.js'

describe('report reason', () => {
  let network: TestNetwork
  let sc: SeedClient
  let pdsAgent: AtpAgent

  const repoSubject = (did: string) => ({
    $type: com.atproto.admin.defs.repoRef.$type,
    did,
  })

  const updateReasonTypes = async (reasonTypes?: string[]) => {
    await pdsAgent.com.atproto.repo.putRecord({
      repo: network.ozone.ctx.cfg.service.did,
      collection: app.bsky.labeler.service.$type,
      rkey: 'self',
      record: {
        policies: { labelValues: [] },
        ...(reasonTypes === undefined ? {} : { reasonTypes }),
        createdAt: new Date().toISOString(),
      },
    })
    await network.processAll()
  }

  const readReportState = async () => {
    const agent = network.ozone.getAgent()
    const { data: reports } = await agent.tools.ozone.report.queryReports(
      { status: 'open', subject: sc.dids.bob, limit: 100 },
      {
        headers: await network.ozone.modHeaders(
          tools.ozone.report.queryReports.$lxm,
          'admin',
        ),
      },
    )
    const events = await network.ozone.getModClient().queryEvents({
      subject: sc.dids.bob,
      limit: 100,
    })
    const activities = await Promise.all(
      reports.reports.map(async ({ id }) => {
        const { data } = await agent.tools.ozone.report.listActivities(
          { reportId: id, limit: 100 },
          {
            headers: await network.ozone.modHeaders(
              tools.ozone.report.listActivities.$lxm,
              'admin',
            ),
          },
        )
        return data
      }),
    )
    return { reports, events, activities }
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)

    // Login with ozone's service account owner and update the service profile definition
    pdsAgent = network.pds.getAgent()
    await pdsAgent.login({
      identifier: 'mod-authority.test',
      password: 'hunter2',
    })
    await updateReasonTypes([tools.ozone.report.defs.ReasonHarassmentTroll])
  })

  afterAll(async () => {
    await network?.close()
  })

  describe('createReport', () => {
    it('only passes for allowed reason types', async () => {
      await expect(
        sc.createReport({
          reasonType: 'tools.ozone.report.defs#reasonHarassmentFake',
          subject: repoSubject(sc.dids.bob),
          reportedBy: sc.dids.alice,
        }),
      ).rejects.toThrow('Invalid reason type')

      const validReport = await sc.createReport({
        reasonType: tools.ozone.report.defs.ReasonHarassmentTroll,
        subject: repoSubject(sc.dids.bob),
        reportedBy: sc.dids.alice,
      })

      expect(forSnapshot(validReport)).toMatchSnapshot()
    })

    it.each([
      {
        name: 'omitted list',
        reasonTypes: undefined,
        accepted: [
          com.atproto.moderation.defs.ReasonSpam,
          tools.ozone.report.defs.ReasonMisleadingSpam,
          'example.report.defs#reasonCustom',
          'spam',
        ],
        rejected: [],
      },
      {
        name: 'empty list',
        reasonTypes: [],
        accepted: [],
        rejected: [
          com.atproto.moderation.defs.ReasonSpam,
          tools.ozone.report.defs.ReasonMisleadingSpam,
          'example.report.defs#reasonCustom',
          'spam',
        ],
      },
      {
        name: 'explicit legacy list',
        reasonTypes: [
          com.atproto.moderation.defs.ReasonSpam,
          com.atproto.moderation.defs.ReasonRude,
        ],
        accepted: [
          com.atproto.moderation.defs.ReasonSpam,
          com.atproto.moderation.defs.ReasonRude,
        ],
        rejected: [
          tools.ozone.report.defs.ReasonMisleadingSpam,
          tools.ozone.report.defs.ReasonHarassmentTroll,
          tools.ozone.report.defs.ReasonViolenceThreats,
          'example.report.defs#reasonCustom',
          'spam',
        ],
      },
      {
        name: 'explicit modern list',
        reasonTypes: [tools.ozone.report.defs.ReasonMisleadingSpam],
        accepted: [tools.ozone.report.defs.ReasonMisleadingSpam],
        rejected: [
          com.atproto.moderation.defs.ReasonSpam,
          tools.ozone.report.defs.ReasonHarassmentTroll,
          'example.report.defs#reasonCustom',
          'spam',
        ],
      },
      {
        name: 'explicit custom list',
        reasonTypes: ['example.report.defs#reasonCustom'],
        accepted: ['example.report.defs#reasonCustom'],
        rejected: [
          com.atproto.moderation.defs.ReasonSpam,
          tools.ozone.report.defs.ReasonMisleadingSpam,
          'example.report.defs#reasonUnlisted',
          'example.report.defs#reasoncustom',
          'spam',
        ],
      },
    ])(
      'enforces $name without writing rejected reports',
      async ({ reasonTypes, accepted, rejected }) => {
        await updateReasonTypes(reasonTypes)
        const createReport = (reasonType: string) =>
          sc.createReport({
            reasonType,
            subject: repoSubject(sc.dids.bob),
            reportedBy: sc.dids.alice,
          })

        for (const reasonType of accepted) {
          await expect(createReport(reasonType)).resolves.toMatchObject({
            reasonType,
          })
        }
        await network.processAll()
        const before = await readReportState()
        for (const reasonType of rejected) {
          await expect(createReport(reasonType)).rejects.toMatchObject({
            status: 400,
            error: 'InvalidRequest',
            message: `Invalid reason type: ${reasonType}`,
          })
        }
        await network.processAll()
        expect(await readReportState()).toEqual(before)
      },
    )
  })

  describe('ModerationServiceProfile', () => {
    it('should validate against updated labeler profile when cache expires', async () => {
      await updateReasonTypes([tools.ozone.report.defs.ReasonHarassmentTroll])
      const cacheTTL = 500
      const cachePopulatedAt = 1_000_000
      const moderationServiceProfile = new ModerationServiceProfile(
        network.ozone.ctx.cfg,
        network.ozone.ctx.appviewClient,
        cacheTTL,
      )

      {
        using _ = jest.spyOn(Date, 'now').mockReturnValue(cachePopulatedAt)
        await expect(
          moderationServiceProfile.validateReasonType(
            'tools.ozone.report.defs#reasonHarassmentFake',
          ),
        ).rejects.toThrow('Invalid reason type')
      }

      await updateReasonTypes(['tools.ozone.report.defs#reasonHarassmentFake'])

      // immediately after the update, the reason type still fails due to cache
      {
        using _ = jest.spyOn(Date, 'now').mockReturnValue(cachePopulatedAt)
        await expect(
          moderationServiceProfile.validateReasonType(
            'tools.ozone.report.defs#reasonHarassmentFake',
          ),
        ).rejects.toThrow('Invalid reason type')
      }

      {
        using _ = jest
          .spyOn(Date, 'now')
          .mockReturnValue(cachePopulatedAt + cacheTTL + 1)

        await expect(
          moderationServiceProfile.validateReasonType(
            'tools.ozone.report.defs#reasonHarassmentFake',
          ),
        ).resolves.toEqual('tools.ozone.report.defs#reasonHarassmentFake')
      }
    })
  })
})
