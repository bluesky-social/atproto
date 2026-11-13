import { jest } from '@jest/globals'
import { Registry, register as defaultRegistry } from 'prom-client'
import type AtpAgent from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { OzoneService } from '@atproto/ozone'
import { MetricsService } from '../src/index.js'
import { app, com, tools } from '../src/lexicons/index.js'
import { ModerationServiceProfile } from '../src/mod-service/profile.js'
import { forSnapshot, startServer } from './_util.js'

describe('report reason', () => {
  let network: TestNetwork
  let sc: SeedClient
  let pdsAgent: AtpAgent
  const metricsRegistry = new Registry()
  const rejectionMetricName = 'ozone_report_reason_rejections_total'

  const readRejections = async () => {
    const counter = metricsRegistry.getSingleMetric(rejectionMetricName)
    if (!counter) throw new Error('Missing report reason rejection counter')
    return (await counter.get()).values.map(({ labels, value }) => ({
      labels: { ...labels },
      value,
    }))
  }

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
    const createOzone = OzoneService.create
    using _ = jest
      .spyOn(OzoneService, 'create')
      .mockImplementation((cfg, secrets, overrides) =>
        createOzone(cfg, secrets, overrides, metricsRegistry),
      )
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

  it('exposes zero counts before the first rejection', async () => {
    expect(await readRejections()).toEqual(
      expect.arrayContaining([
        {
          labels: {
            nsid: com.atproto.moderation.createReport.$lxm,
            reason_type: tools.ozone.report.defs.ReasonMisleadingSpam,
          },
          value: 0,
        },
        {
          labels: {
            nsid: tools.ozone.moderation.emitEvent.$lxm,
            reason_type: 'unknown',
          },
          value: 0,
        },
      ]),
    )
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
          'appeal',
          'example.report.defs#reasonAppeal',
          `${tools.ozone.report.defs.ReasonAppeal}-unknown`,
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

  describe.each([
    com.atproto.moderation.createReport.$lxm,
    tools.ozone.moderation.emitEvent.$lxm,
  ])('appeals through %s', (nsid) => {
    it.each([
      { name: 'omitted list', reasonTypes: undefined },
      { name: 'empty list', reasonTypes: [] },
      {
        name: 'unrelated list',
        reasonTypes: [com.atproto.moderation.defs.ReasonSpam],
      },
      {
        name: 'legacy appeal only',
        reasonTypes: [com.atproto.moderation.defs.ReasonAppeal],
      },
      {
        name: 'modern appeal only',
        reasonTypes: [tools.ozone.report.defs.ReasonAppeal],
      },
    ])('accepts both appeal types with $name', async ({ reasonTypes }) => {
      await updateReasonTypes(reasonTypes)
      const before = await readRejections()
      const post = sc.posts[sc.dids.bob][0].ref
      const subject = {
        $type: com.atproto.repo.strongRef.$type,
        uri: post.uriStr,
        cid: post.cidStr,
      }

      for (const reasonType of [
        com.atproto.moderation.defs.ReasonAppeal,
        tools.ozone.report.defs.ReasonAppeal,
      ]) {
        if (nsid === com.atproto.moderation.createReport.$lxm) {
          await expect(
            sc.createReport({
              reasonType,
              subject,
              reportedBy: sc.dids.bob,
            }),
          ).resolves.toMatchObject({ reasonType, subject })
        } else {
          await expect(
            network.ozone.getModClient().emitEvent({
              subject,
              event: {
                $type: tools.ozone.moderation.defs.modEventReport.$type,
                reportType: reasonType,
              },
            }),
          ).resolves.toMatchObject({
            subject,
            event: { reportType: reasonType },
          })
        }
      }
      expect(await readRejections()).toEqual(before)
    })
  })

  describe('rejection metrics', () => {
    it.each([
      com.atproto.moderation.createReport.$lxm,
      tools.ozone.moderation.emitEvent.$lxm,
    ])('counts only allowlist rejections through %s', async (nsid) => {
      const submitReport = (reasonType: string) =>
        nsid === com.atproto.moderation.createReport.$lxm
          ? sc.createReport({
              reasonType,
              subject: repoSubject(sc.dids.bob),
              reportedBy: sc.dids.alice,
            })
          : network.ozone.getModClient().emitEvent({
              subject: repoSubject(sc.dids.bob),
              event: {
                $type: tools.ozone.moderation.defs.modEventReport.$type,
                reportType: reasonType,
              },
            })
      const before = await readRejections()
      const customReason = 'example.report.defs#reasonAllowed'

      await updateReasonTypes()
      await submitReport(customReason)
      await updateReasonTypes([
        com.atproto.moderation.defs.ReasonSpam,
        customReason,
      ])
      await submitReport(com.atproto.moderation.defs.ReasonSpam)
      await submitReport(customReason)
      expect(await readRejections()).toEqual(before)

      await network.processAll()
      const reportState = await readReportState()
      const unknownReasons = [
        'example.report.defs#reasonCustomOne',
        'example.report.defs#reasonCustomTwo',
        `${tools.ozone.report.defs.ReasonMisleadingSpam}-unknown`,
      ]
      for (const reasonType of [
        tools.ozone.report.defs.ReasonMisleadingSpam,
        com.atproto.moderation.defs.ReasonRude,
        ...unknownReasons,
      ]) {
        await expect(submitReport(reasonType)).rejects.toMatchObject({
          status: 400,
          error: 'InvalidRequest',
          message: `Invalid reason type: ${reasonType}`,
        })
      }
      await network.processAll()
      expect(await readReportState()).toEqual(reportState)

      const countsBefore = new Map(
        before.map(({ labels, value }) => [JSON.stringify(labels), value]),
      )
      const after = await readRejections()
      expect(after).toHaveLength(before.length)
      const changed = after.filter(
        ({ labels, value }) =>
          value !== countsBefore.get(JSON.stringify(labels)),
      )
      expect(changed).toHaveLength(3)
      for (const [reason_type, count] of [
        [tools.ozone.report.defs.ReasonMisleadingSpam, 1],
        [com.atproto.moderation.defs.ReasonRude, 1],
        ['unknown', unknownReasons.length],
      ] as const) {
        const labels = { nsid, reason_type }
        expect(changed).toContainEqual({
          labels,
          value: (countsBefore.get(JSON.stringify(labels)) ?? 0) + count,
        })
      }

      const exported = await metricsRegistry.metrics()
      for (const unknownReason of unknownReasons) {
        expect(exported).not.toContain(unknownReason)
      }

      await updateReasonTypes([])
      await expect(
        submitReport(com.atproto.moderation.defs.ReasonSpam),
      ).rejects.toMatchObject({ status: 400, error: 'InvalidRequest' })
      expect(await readRejections()).toContainEqual({
        labels: { nsid, reason_type: com.atproto.moderation.defs.ReasonSpam },
        value:
          (countsBefore.get(
            JSON.stringify({
              nsid,
              reason_type: com.atproto.moderation.defs.ReasonSpam,
            }),
          ) ?? 0) + 1,
      })
    })

    it.each([
      com.atproto.moderation.defs.ReasonAppeal,
      tools.ozone.report.defs.ReasonAppeal,
    ])('still rejects unauthorized appeals using %s', async (reasonType) => {
      await updateReasonTypes([])
      const before = await readRejections()
      await expect(
        sc.createReport({
          reasonType,
          subject: repoSubject(sc.dids.bob),
          reportedBy: sc.dids.alice,
        }),
      ).rejects.toMatchObject({
        status: 403,
        message: 'You cannot appeal this report',
      })
      expect(await readRejections()).toEqual(before)
    })

    it('does not collect rejections without an opted-in registry', async () => {
      await updateReasonTypes([])
      const before = await readRejections()
      const createProfile = ModerationServiceProfile.creator(
        network.ozone.ctx.cfg,
        network.ozone.ctx.appviewClient,
      )
      await expect(
        createProfile().validateReasonType(
          com.atproto.moderation.defs.ReasonSpam,
          com.atproto.moderation.createReport.$lxm,
        ),
      ).rejects.toThrow('Invalid reason type')
      expect(await readRejections()).toEqual(before)
      expect(
        defaultRegistry.getSingleMetric(rejectionMetricName),
      ).toBeUndefined()
    })

    it('serves the counter on the separate metrics server', async () => {
      await using server = await startServer(
        MetricsService.create(metricsRegistry).app,
      )
      const response = await fetch(`http://localhost:${server.port}/metrics`)
      expect(response.status).toBe(200)
      expect(await response.text()).toContain(
        `${rejectionMetricName}{nsid="${com.atproto.moderation.createReport.$lxm}",reason_type="${tools.ozone.report.defs.ReasonMisleadingSpam}"}`,
      )
      expect((await fetch(`${network.ozone.url}/metrics`)).status).toBe(404)
    })
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
            com.atproto.moderation.createReport.$lxm,
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
            com.atproto.moderation.createReport.$lxm,
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
            com.atproto.moderation.createReport.$lxm,
          ),
        ).resolves.toEqual('tools.ozone.report.defs#reasonHarassmentFake')
      }
    })
  })
})
