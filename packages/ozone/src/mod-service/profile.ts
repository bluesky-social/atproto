import AtpAgent, { AppBskyLabelerDefs } from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { OzoneConfig } from '../config'
import { httpLogger } from '../logger'
import { MINUTE } from '@atproto/common'

interface CacheEntry {
  profile: AppBskyLabelerDefs.LabelerViewDetailed | null
  timestamp: number
}

export type ModerationServiceProfileCreator = () => ModerationServiceProfile

export class ModerationServiceProfile {
  private cache: CacheEntry | null = null
  private CACHE_TTL: number

  constructor(
    private cfg: OzoneConfig,
    private appviewAgent: AtpAgent,
    cacheTTL?: number,
  ) {
    this.CACHE_TTL = cacheTTL || cfg.service.serviceRecordCacheTTL || 5 * MINUTE
  }

  static creator(
    cfg: OzoneConfig,
    appviewAgent: AtpAgent,
  ): ModerationServiceProfileCreator {
    return () => new ModerationServiceProfile(cfg, appviewAgent)
  }

  async validateReasonType(reasonType: string): Promise<string> {
    const now = Date.now()

    if (!this.cache || now - this.cache.timestamp > this.CACHE_TTL) {
      try {
        const { data } = await this.appviewAgent.app.bsky.labeler.getServices({
          dids: [this.cfg.service.did],
          detailed: true,
        })

        if (AppBskyLabelerDefs.isLabelerViewDetailed(data.views?.[0])) {
          this.cache = {
            profile: data.views[0],
            timestamp: now,
          }
        }
      } catch (e) {
        // On error, fail open
        httpLogger.error(`Failed to fetch labeler profile: ${e?.['message']}`)
      }
    }

    if (
      this.cache?.profile?.reasonTypes &&
      Array.isArray(this.cache.profile.reasonTypes)
    ) {
      if (this.cache?.profile?.reasonTypes.includes(reasonType)) {
        return reasonType
      }
      throw new InvalidRequestError(`Invalid reason type: ${reasonType}`)
    }

    return reasonType
  }
}
