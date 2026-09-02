import type { Client } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { OzoneConfig } from '../config/index.js'
import { app, com } from '../lexicons/index.js'
import { httpLogger } from '../logger.js'

// Reverse mapping from new ozone namespaced reason types to old com.atproto namespaced reason types
export const NEW_TO_OLD_REASON_MAPPING: Record<string, string> = {
  'tools.ozone.report.defs#reasonAppeal':
    com.atproto.moderation.defs.ReasonAppeal,
  'tools.ozone.report.defs#reasonOther':
    com.atproto.moderation.defs.ReasonOther,

  'tools.ozone.report.defs#reasonViolenceAnimal':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonViolenceThreats':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonViolenceGraphicContent':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonViolenceGlorification':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonViolenceExtremistContent':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonViolenceTrafficking':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonViolenceOther':
    com.atproto.moderation.defs.ReasonViolation,

  'tools.ozone.report.defs#reasonSexualAbuseContent':
    com.atproto.moderation.defs.ReasonSexual,
  'tools.ozone.report.defs#reasonSexualNCII':
    com.atproto.moderation.defs.ReasonSexual,
  'tools.ozone.report.defs#reasonSexualDeepfake':
    com.atproto.moderation.defs.ReasonSexual,
  'tools.ozone.report.defs#reasonSexualAnimal':
    com.atproto.moderation.defs.ReasonSexual,
  'tools.ozone.report.defs#reasonSexualUnlabeled':
    com.atproto.moderation.defs.ReasonSexual,
  'tools.ozone.report.defs#reasonSexualOther':
    com.atproto.moderation.defs.ReasonSexual,

  'tools.ozone.report.defs#reasonChildSafetyCSAM':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonChildSafetyGroom':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonChildSafetyPrivacy':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonChildSafetyHarassment':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonChildSafetyOther':
    com.atproto.moderation.defs.ReasonViolation,

  'tools.ozone.report.defs#reasonHarassmentTroll':
    com.atproto.moderation.defs.ReasonRude,
  'tools.ozone.report.defs#reasonHarassmentTargeted':
    com.atproto.moderation.defs.ReasonRude,
  'tools.ozone.report.defs#reasonHarassmentHateSpeech':
    com.atproto.moderation.defs.ReasonRude,
  'tools.ozone.report.defs#reasonHarassmentDoxxing':
    com.atproto.moderation.defs.ReasonRude,
  'tools.ozone.report.defs#reasonHarassmentOther':
    com.atproto.moderation.defs.ReasonRude,

  'tools.ozone.report.defs#reasonMisleadingBot':
    com.atproto.moderation.defs.ReasonMisleading,
  'tools.ozone.report.defs#reasonMisleadingImpersonation':
    com.atproto.moderation.defs.ReasonMisleading,
  'tools.ozone.report.defs#reasonMisleadingSpam':
    com.atproto.moderation.defs.ReasonSpam,
  'tools.ozone.report.defs#reasonMisleadingScam':
    com.atproto.moderation.defs.ReasonMisleading,
  'tools.ozone.report.defs#reasonMisleadingElections':
    com.atproto.moderation.defs.ReasonMisleading,
  'tools.ozone.report.defs#reasonMisleadingOther':
    com.atproto.moderation.defs.ReasonMisleading,

  'tools.ozone.report.defs#reasonRuleSiteSecurity':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonRuleProhibitedSales':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonRuleBanEvasion':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonRuleOther':
    com.atproto.moderation.defs.ReasonViolation,

  'tools.ozone.report.defs#reasonSelfHarmContent':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonSelfHarmED':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonSelfHarmStunts':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonSelfHarmSubstances':
    com.atproto.moderation.defs.ReasonViolation,
  'tools.ozone.report.defs#reasonSelfHarmOther':
    com.atproto.moderation.defs.ReasonViolation,
}

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
