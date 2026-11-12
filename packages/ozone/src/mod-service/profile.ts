import { Counter, type Registry } from 'prom-client'
import type { Client } from '@atproto/lex-client'
import { TokenSchema } from '@atproto/lex-schema'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { isAppealReport } from '../api/util.js'
import type { OzoneConfig } from '../config/index.js'
import { app, com, tools } from '../lexicons/index.js'
import { httpLogger } from '../logger.js'

type ReportMethod =
  | typeof com.atproto.moderation.createReport.$lxm
  | typeof tools.ozone.moderation.emitEvent.$lxm

const KNOWN_REASON_TYPES = new Set<string>(
  [com.atproto.moderation.defs, tools.ozone.report.defs].flatMap((defs) =>
    Object.values(defs)
      .filter((value) => value instanceof TokenSchema)
      .map((token) => token.value),
  ),
)

interface CacheEntry {
  profile: app.bsky.labeler.defs.LabelerViewDetailed | null
  timestamp: number
}

export type ModerationServiceProfileCreator = () => ModerationServiceProfile

export class ModerationServiceProfile {
  private cache: CacheEntry | null = null
  private CACHE_TTL: number

  constructor(
    private cfg: OzoneConfig,
    private appviewClient: Client,
    cacheTTL?: number,
    private reasonRejections?: Counter<'nsid' | 'reason_type'>,
  ) {
    this.CACHE_TTL = cacheTTL || cfg.service.serviceRecordCacheTTL
  }

  static creator(
    cfg: OzoneConfig,
    appviewClient: Client,
    register?: Registry,
  ): ModerationServiceProfileCreator {
    const reasonRejections = register
      ? new Counter({
          name: 'ozone_report_reason_rejections_total',
          help: 'Report attempts rejected because the reason type is not in the labeler allowlist',
          labelNames: ['nsid', 'reason_type'] as const,
          registers: [register],
        })
      : undefined

    if (reasonRejections) {
      for (const nsid of [
        com.atproto.moderation.createReport.$lxm,
        tools.ozone.moderation.emitEvent.$lxm,
      ]) {
        for (const reason_type of [...KNOWN_REASON_TYPES, 'unknown']) {
          reasonRejections.inc({ nsid, reason_type }, 0)
        }
      }
    }

    return () =>
      new ModerationServiceProfile(
        cfg,
        appviewClient,
        undefined,
        reasonRejections,
      )
  }

  async getProfile() {
    const now = Date.now()

    if (!this.cache || now - this.cache.timestamp > this.CACHE_TTL) {
      try {
        const body = await this.appviewClient.call(
          app.bsky.labeler.getServices,
          { dids: [this.cfg.service.did], detailed: true },
        )

        if (
          app.bsky.labeler.defs.labelerViewDetailed.$isTypeOf(body.views?.[0])
        ) {
          this.cache = {
            profile: body.views[0],
            timestamp: now,
          }
        }
      } catch (e) {
        // On error, fail open
        httpLogger.error(`Failed to fetch labeler profile: ${e?.['message']}`)
      }
    }

    return this.cache?.profile || null
  }

  async validateReasonType(
    reasonType: string,
    nsid: ReportMethod,
  ): Promise<string> {
    // @NOTE appeals remain available regardless of the report-type allowlist.
    if (isAppealReport(reasonType)) {
      return reasonType
    }

    const profile = await this.getProfile()

    if (
      Array.isArray(profile?.reasonTypes) &&
      !profile.reasonTypes.includes(reasonType)
    ) {
      // @NOTE caller-supplied custom values must not create unbounded series.
      this.reasonRejections?.inc({
        nsid,
        reason_type: KNOWN_REASON_TYPES.has(reasonType)
          ? reasonType
          : 'unknown',
      })
      throw new InvalidRequestError(`Invalid reason type: ${reasonType}`)
    }

    return reasonType
  }
}
