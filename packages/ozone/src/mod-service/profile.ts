import AtpAgent, { AppBskyLabelerDefs } from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { OzoneConfig } from '../config'
import {
  REASONAPPEAL,
  REASONMISLEADING,
  REASONRUDE,
  REASONSEXUAL,
  REASONSPAM,
  REASONVIOLATION,
} from '../lexicon/types/com/atproto/moderation/defs'
import { httpLogger } from '../logger'

// Reverse mapping from new ozone namespaced reason types to old com.atproto namespaced reason types
export const NEW_TO_OLD_REASON_MAPPING: Record<string, string> = {
  'tools.ozone.report.defs#reasonMisleadingSpam': REASONSPAM,
  'tools.ozone.report.defs#reasonRuleOther': REASONVIOLATION,
  'tools.ozone.report.defs#reasonMisleadingOther': REASONMISLEADING,
  'tools.ozone.report.defs#reasonSexualUnlabeled': REASONSEXUAL,
  'tools.ozone.report.defs#reasonHarassmentOther': REASONRUDE,
  'tools.ozone.report.defs#reasonAppeal': REASONAPPEAL,
  // Map all violence-related reasons to REASONVIOLATION
  'tools.ozone.report.defs#reasonViolenceAnimalWelfare': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceThreats': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceGraphicContent': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceSelfHarm': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceGlorification': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceExtremistContent': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceTrafficking': REASONVIOLATION,
  'tools.ozone.report.defs#reasonViolenceOther': REASONVIOLATION,
  // Map all sexual-related reasons to REASONSEXUAL
  'tools.ozone.report.defs#reasonSexualAbuseContent': REASONSEXUAL,
  'tools.ozone.report.defs#reasonSexualNCII': REASONSEXUAL,
  'tools.ozone.report.defs#reasonSexualSextortion': REASONSEXUAL,
  'tools.ozone.report.defs#reasonSexualDeepfake': REASONSEXUAL,
  'tools.ozone.report.defs#reasonSexualAnimal': REASONSEXUAL,
  'tools.ozone.report.defs#reasonSexualOther': REASONSEXUAL,
  // Map all child safety reasons to REASONVIOLATION
  'tools.ozone.report.defs#reasonChildSafetyCSAM': REASONVIOLATION,
  'tools.ozone.report.defs#reasonChildSafetyGroom': REASONVIOLATION,
  'tools.ozone.report.defs#reasonChildSafetyMinorPrivacy': REASONVIOLATION,
  'tools.ozone.report.defs#reasonChildSafetyEndangerment': REASONVIOLATION,
  'tools.ozone.report.defs#reasonChildSafetyHarassment': REASONVIOLATION,
  'tools.ozone.report.defs#reasonChildSafetyPromotion': REASONVIOLATION,
  'tools.ozone.report.defs#reasonChildSafetyOther': REASONVIOLATION,
  // Map all harassment reasons to REASONRUDE
  'tools.ozone.report.defs#reasonHarassmentTroll': REASONRUDE,
  'tools.ozone.report.defs#reasonHarassmentTargeted': REASONRUDE,
  'tools.ozone.report.defs#reasonHarassmentHateSpeech': REASONRUDE,
  'tools.ozone.report.defs#reasonHarassmentDoxxing': REASONRUDE,
  // Map all misleading reasons to REASONMISLEADING
  'tools.ozone.report.defs#reasonMisleadingBot': REASONMISLEADING,
  'tools.ozone.report.defs#reasonMisleadingImpersonation': REASONMISLEADING,
  'tools.ozone.report.defs#reasonMisleadingScam': REASONMISLEADING,
  'tools.ozone.report.defs#reasonMisleadingSyntheticContent': REASONMISLEADING,
  'tools.ozone.report.defs#reasonMisleadingMisinformation': REASONMISLEADING,
  // Map all rule-related reasons to REASONVIOLATION
  'tools.ozone.report.defs#reasonRuleSiteSecurity': REASONVIOLATION,
  'tools.ozone.report.defs#reasonRuleStolenContent': REASONVIOLATION,
  'tools.ozone.report.defs#reasonRuleProhibitedSales': REASONVIOLATION,
  'tools.ozone.report.defs#reasonRuleBanEvasion': REASONVIOLATION,
  // Map all civic reasons to REASONMISLEADING
  'tools.ozone.report.defs#reasonCivicElectoralProcess': REASONMISLEADING,
  'tools.ozone.report.defs#reasonCivicDisclosure': REASONMISLEADING,
  'tools.ozone.report.defs#reasonCivicInterference': REASONMISLEADING,
  'tools.ozone.report.defs#reasonCivicMisinformation': REASONMISLEADING,
  'tools.ozone.report.defs#reasonCivicImpersonation': REASONMISLEADING,
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
