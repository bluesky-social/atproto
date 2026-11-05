import type { Client } from '@atproto/lex-client'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { OzoneConfig } from '../config/index.js'
import { app } from '../lexicons/index.js'
import { httpLogger } from '../logger.js'

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
  ) {
    this.CACHE_TTL = cacheTTL || cfg.service.serviceRecordCacheTTL
  }

  static creator(
    cfg: OzoneConfig,
    appviewClient: Client,
  ): ModerationServiceProfileCreator {
    return () => new ModerationServiceProfile(cfg, appviewClient)
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

  async validateReasonType(reasonType: string): Promise<string> {
    const profile = await this.getProfile()

    if (
      Array.isArray(profile?.reasonTypes) &&
      !profile.reasonTypes.includes(reasonType)
    ) {
      throw new InvalidRequestError(`Invalid reason type: ${reasonType}`)
    }

    return reasonType
  }
}
