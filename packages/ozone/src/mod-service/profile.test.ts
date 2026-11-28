import { register as defaultRegistry } from 'prom-client'
import { describe, expect, it, vi } from 'vitest'
import type { Client } from '@atproto/lex-client'
import type { OzoneConfig } from '../config/index.js'
import { app, com, tools } from '../lexicons/index.js'
import { ModerationServiceProfile } from './profile.js'

const cfg = {
  service: { did: 'did:plc:ozone', serviceRecordCacheTTL: 0 },
} as unknown as OzoneConfig

function stubAppview(reasonTypes: { current: string[] }) {
  const call = vi.fn(async () => ({
    views: [
      {
        $type: app.bsky.labeler.defs.labelerViewDetailed.$type,
        reasonTypes: reasonTypes.current,
      },
    ],
  }))
  return { call, client: { call } as unknown as Client }
}

describe(ModerationServiceProfile, () => {
  it('validates against the updated labeler profile when the cache expires', async () => {
    const reasonTypes: { current: string[] } = {
      current: [tools.ozone.report.defs.ReasonHarassmentTroll],
    }
    const appview = stubAppview(reasonTypes)
    const cacheTTL = 500
    const cachePopulatedAt = 1_000_000
    const moderationServiceProfile = new ModerationServiceProfile(
      cfg,
      appview.client,
      cacheTTL,
    )

    {
      using _ = vi.spyOn(Date, 'now').mockReturnValue(cachePopulatedAt)
      await expect(
        moderationServiceProfile.validateReasonType(
          'tools.ozone.report.defs#reasonHarassmentFake',
          com.atproto.moderation.createReport.$lxm,
        ),
      ).rejects.toThrow('Invalid reason type')
    }

    reasonTypes.current = ['tools.ozone.report.defs#reasonHarassmentFake']

    // immediately after the update, the reason type still fails due to cache
    {
      using _ = vi.spyOn(Date, 'now').mockReturnValue(cachePopulatedAt)
      await expect(
        moderationServiceProfile.validateReasonType(
          'tools.ozone.report.defs#reasonHarassmentFake',
          com.atproto.moderation.createReport.$lxm,
        ),
      ).rejects.toThrow('Invalid reason type')
    }

    {
      using _ = vi
        .spyOn(Date, 'now')
        .mockReturnValue(cachePopulatedAt + cacheTTL + 1)

      await expect(
        moderationServiceProfile.validateReasonType(
          'tools.ozone.report.defs#reasonHarassmentFake',
          com.atproto.moderation.createReport.$lxm,
        ),
      ).resolves.toEqual('tools.ozone.report.defs#reasonHarassmentFake')
    }

    expect(appview.call).toHaveBeenCalledTimes(2)
  })

  it('does not collect rejections without an opted-in registry', async () => {
    const appview = stubAppview({ current: [] })
    const createProfile = ModerationServiceProfile.creator(cfg, appview.client)

    await expect(
      createProfile().validateReasonType(
        com.atproto.moderation.defs.ReasonSpam,
        com.atproto.moderation.createReport.$lxm,
      ),
    ).rejects.toThrow('Invalid reason type')
    expect(
      defaultRegistry.getSingleMetric('ozone_report_reason_rejections_total'),
    ).toBeUndefined()
  })
})
