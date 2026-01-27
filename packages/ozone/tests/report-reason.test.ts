import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import {
  REASONRUDE,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import { REASONHARASSMENTTROLL } from '../src/lexicon/types/tools/ozone/report/defs'
import { ModerationServiceProfile } from '../src/mod-service/profile'
import { forSnapshot } from './_util'

describe('report reason', () => {
  let network: TestNetwork
  let sc: SeedClient
  let pdsAgent: AtpAgent

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)

    // Login with ozone's service account owner and update the service profile definition
    pdsAgent = network.pds.getClient()
    await pdsAgent.login({
      identifier: 'mod-authority.test',
      password: 'hunter2',
    })
    await pdsAgent.com.atproto.repo.putRecord({
      repo: network.ozone.ctx.cfg.service.did,
      collection: 'app.bsky.labeler.service',
      rkey: 'self',
      record: {
        policies: { labelValues: [] },
        reasonTypes: ['tools.ozone.report.defs#reasonHarassmentTroll'],
        createdAt: new Date().toISOString(),
      },
    })

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
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
        reasonType: 'tools.ozone.report.defs#reasonHarassmentTroll',
        subject: repoSubject(sc.dids.bob),
        reportedBy: sc.dids.alice,
      })

      expect(forSnapshot(validReport)).toMatchSnapshot()
    })

    it('can use both tools.ozone and com.atproto lexicons for reporting', async () => {
      const [comAtprotoReport, { data: toolsOzoneReport }] = await Promise.all([
        sc.createReport({
          reasonType: REASONHARASSMENTTROLL,
          subject: repoSubject(sc.dids.carol),
          reportedBy: sc.dids.alice,
        }),
        network.pds.getClient().tools.ozone.report.createReport(
          {
            reasonType: REASONHARASSMENTTROLL,
            subject: repoSubject(sc.dids.carol),
          },
          {
            encoding: 'application/json',
            headers: {
              ...sc.getHeaders(sc.dids.alice),
              'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
            },
          },
        ),
      ])

      expect({
        reasonType: comAtprotoReport.reasonType,
        subject: comAtprotoReport.subject,
        reportedBy: comAtprotoReport.reportedBy,
      }).toMatchObject({
        reasonType: toolsOzoneReport.reasonType,
        subject: toolsOzoneReport.subject,
        reportedBy: toolsOzoneReport.reportedBy,
      })
    })
  })
  describe('ModerationServiceProfile', () => {
    it('should validate against updated labeler profile when cache expires', async () => {
      const moderationServiceProfile = new ModerationServiceProfile(
        network.ozone.ctx.cfg,
        network.ozone.ctx.appviewAgent,
        500,
      )

      await expect(
        moderationServiceProfile.validateReasonType(
          'tools.ozone.report.defs#reasonHarassmentFake',
        ),
      ).rejects.toThrow('Invalid reason type')

      // Update labeler profile to add the new reason type
      await pdsAgent.com.atproto.repo.putRecord({
        repo: network.ozone.ctx.cfg.service.did,
        collection: 'app.bsky.labeler.service',
        rkey: 'self',
        record: {
          policies: { labelValues: [] },
          reasonTypes: ['tools.ozone.report.defs#reasonHarassmentFake'],
          createdAt: new Date().toISOString(),
        },
      })
      await network.processAll()

      // immediately after the update, the reason type still fails due to cache
      await expect(
        moderationServiceProfile.validateReasonType(
          'tools.ozone.report.defs#reasonHarassmentFake',
        ),
      ).rejects.toThrow('Invalid reason type')

      // add some manual delay to ensure cache is expired and try again
      await new Promise((resolve) => setTimeout(resolve, 500))
      await expect(
        moderationServiceProfile.validateReasonType(
          'tools.ozone.report.defs#reasonHarassmentFake',
        ),
      ).resolves.toEqual('tools.ozone.report.defs#reasonHarassmentFake')
    })

    it('should validate mapped reason types', async () => {
      const moderationServiceProfile = new ModerationServiceProfile(
        network.ozone.ctx.cfg,
        network.ozone.ctx.appviewAgent,
        500,
      )

      // Set up labeler profile with old reason types only
      await pdsAgent.com.atproto.repo.putRecord({
        repo: network.ozone.ctx.cfg.service.did,
        collection: 'app.bsky.labeler.service',
        rkey: 'self',
        record: {
          policies: { labelValues: [] },
          reasonTypes: [REASONSPAM, REASONRUDE],
          createdAt: new Date().toISOString(),
        },
      })
      await network.processAll()

      await new Promise((resolve) => setTimeout(resolve, 500))

      await expect(
        moderationServiceProfile.validateReasonType(
          'tools.ozone.report.defs#reasonMisleadingSpam',
        ),
      ).resolves.toEqual('tools.ozone.report.defs#reasonMisleadingSpam')

      // directly supported old reason types work
      await expect(
        moderationServiceProfile.validateReasonType(REASONSPAM),
      ).resolves.toEqual(REASONSPAM)

      // new reason types that don't map to supported old reason types are rejected
      await expect(
        moderationServiceProfile.validateReasonType(
          'tools.ozone.report.defs#reasonViolenceThreats',
        ),
      ).rejects.toThrow('Invalid reason type')
    })
  })
})
