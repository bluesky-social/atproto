import AtpAgent, { AppBskyLabelerDefs } from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { OzoneConfig } from '../config'
import {
  REASONAPPEAL,
  REASONMISLEADING,
  REASONOTHER,
  REASONRUDE,
  REASONSEXUAL,
  REASONSPAM,
  REASONVIOLATION,
} from '../lexicon/types/com/atproto/moderation/defs'
import { httpLogger } from '../logger'

// Reverse mapping from new ozone namespaced reason types to old com.atproto namespaced reason types
export const NEW_TO_OLD_REASON_MAPPING: Record<string, string> = {
  'tools.ozone.report.defs#reasonAppeal': REASONAPPEAL,
  'tools.ozone.report.defs#reasonOther': REASONOTHER,

  'tools.ozone.report.defs#reasonViolenceAnimal': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceThreats': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceGraphicContent': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceGlorification': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceExtremistContent': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceTrafficking': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceOther': REASONVIOLATION,

  'tools.ozone.report.defs#reasonSexualAbuseContent': REASONSEXUAL,
  'tools.ozone.report.defs#reasonSexualNCII': REASONSEXUAL,
  'tools.ozone.report.defs#reasonSexualDeepfake': REASONSEXUAL,
  'tools.ozone.report.defs#reasonSexualAnimal': REASONSEXUAL,
  'tools.ozone.report.defs#reasonSexualUnlabeled': REASONSEXUAL,
  'tools.ozone.report.defs#reasonSexualOther': REASONSEXUAL,

  'tools.ozone.report.defs#reasonChildSafetyCSAM': REASONVIOLATION,
  'tools.ozone.report.defs#reasonChildSafetyGroom': REASONVIOLATION,
  'tools.ozone.report.defs#reasonChildSafetyPrivacy': REASONVIOLATION,
  'tools.ozone.report.defs#reasonChildSafetyHarassment': REASONVIOLATION,
  'tools.ozone.report.defs#reasonChildSafetyOther': REASONVIOLATION,

  'tools.ozone.report.defs#reasonHarassmentTroll': REASONRUDE,
  'tools.ozone.report.defs#reasonHarassmentTargeted': REASONRUDE,
  'tools.ozone.report.defs#reasonHarassmentHateSpeech': REASONRUDE,
  'tools.ozone.report.defs#reasonHarassmentDoxxing': REASONRUDE,
  'tools.ozone.report.defs#reasonHarassmentOther': REASONRUDE,

  'tools.ozone.report.defs#reasonMisleadingBot': REASONMISLEADING,
  'tools.ozone.report.defs#reasonMisleadingImpersonation': REASONMISLEADING,
  'tools.ozone.report.defs#reasonMisleadingSpam': REASONSPAM,
  'tools.ozone.report.defs#reasonMisleadingScam': REASONMISLEADING,
  'tools.ozone.report.defs#reasonMisleadingElections': REASONMISLEADING,
  'tools.ozone.report.defs#reasonMisleadingOther': REASONMISLEADING,

  'tools.ozone.report.defs#reasonRuleSiteSecurity': REASONVIOLATION,
  'tools.ozone.report.defs#reasonRuleProhibitedSales': REASONVIOLATION,
  'tools.ozone.report.defs#reasonRuleBanEvasion': REASONVIOLATION,
  'tools.ozone.report.defs#reasonRuleOther': REASONVIOLATION,

  'tools.ozone.report.defs#reasonSelfHarmContent': REASONVIOLATION,
  'tools.ozone.report.defs#reasonSelfHarmED': REASONVIOLATION,
  'tools.ozone.report.defs#reasonSelfHarmStunts': REASONVIOLATION,
  'tools.ozone.report.defs#reasonSelfHarmSubstances': REASONVIOLATION,
  'tools.ozone.report.defs#reasonSelfHarmOther': REASONVIOLATION,
}

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
    this.CACHE_TTL = cacheTTL || cfg.service.serviceRecordCacheTTL
  }

  static creator(
    cfg: OzoneConfig,
    appviewAgent: AtpAgent,
  ): ModerationServiceProfileCreator {
    return () => new ModerationServiceProfile(cfg, appviewAgent)
  }

  async getProfile() {
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

    return this.cache?.profile || null
  }

  async validateReasonType(reasonType: string): Promise<string> {
    const profile = await this.getProfile()

    if (!Array.isArray(profile?.reasonTypes)) {
      return reasonType
    }

    const supportedReasonTypes = profile.reasonTypes

    // Check if the reason type is directly supported
    if (supportedReasonTypes.includes(reasonType)) {
      return reasonType
    }

    // Allow new reason types only if they map to a supported old reason type
    const mappedOldReason = NEW_TO_OLD_REASON_MAPPING[reasonType]
    if (mappedOldReason && supportedReasonTypes.includes(mappedOldReason)) {
      return reasonType
    }

    throw new InvalidRequestError(`Invalid reason type: ${reasonType}`)
  }
}
