import AtpAgent, { AppBskyLabelerDefs } from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { OzoneConfig } from '../config'
import * as ATReportDefs from '../lexicon/types/com/atproto/moderation/defs'
import * as ReportDefs from '../lexicon/types/tools/ozone/report/defs'
import { httpLogger } from '../logger'

// Reverse mapping from new ozone namespaced reason types to old com.atproto namespaced reason types
export const NEW_TO_OLD_REASON_MAPPING: Record<
  ReportDefs.ReasonType,
  ATReportDefs.ReasonType
> = {
  [ReportDefs.REASONAPPEAL]: ATReportDefs.REASONAPPEAL,
  [ReportDefs.REASONOTHER]: ATReportDefs.REASONOTHER,

  [ReportDefs.REASONVIOLENCEANIMAL]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONVIOLENCETHREATS]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONVIOLENCEGRAPHICCONTENT]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONVIOLENCEGLORIFICATION]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONVIOLENCEEXTREMISTCONTENT]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONVIOLENCETRAFFICKING]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONVIOLENCEOTHER]: ATReportDefs.REASONVIOLATION,

  [ReportDefs.REASONSEXUALABUSECONTENT]: ATReportDefs.REASONSEXUAL,
  [ReportDefs.REASONSEXUALNCII]: ATReportDefs.REASONSEXUAL,
  [ReportDefs.REASONSEXUALDEEPFAKE]: ATReportDefs.REASONSEXUAL,
  [ReportDefs.REASONSEXUALANIMAL]: ATReportDefs.REASONSEXUAL,
  [ReportDefs.REASONSEXUALUNLABELED]: ATReportDefs.REASONSEXUAL,
  [ReportDefs.REASONSEXUALOTHER]: ATReportDefs.REASONSEXUAL,

  [ReportDefs.REASONCHILDSAFETYCSAM]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONCHILDSAFETYGROOM]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONCHILDSAFETYPRIVACY]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONCHILDSAFETYHARASSMENT]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONCHILDSAFETYOTHER]: ATReportDefs.REASONVIOLATION,

  [ReportDefs.REASONHARASSMENTTROLL]: ATReportDefs.REASONRUDE,
  [ReportDefs.REASONHARASSMENTTARGETED]: ATReportDefs.REASONRUDE,
  [ReportDefs.REASONHARASSMENTHATESPEECH]: ATReportDefs.REASONRUDE,
  [ReportDefs.REASONHARASSMENTDOXXING]: ATReportDefs.REASONRUDE,
  [ReportDefs.REASONHARASSMENTOTHER]: ATReportDefs.REASONRUDE,

  [ReportDefs.REASONMISLEADINGBOT]: ATReportDefs.REASONMISLEADING,
  [ReportDefs.REASONMISLEADINGIMPERSONATION]: ATReportDefs.REASONMISLEADING,
  [ReportDefs.REASONMISLEADINGSPAM]: ATReportDefs.REASONSPAM,
  [ReportDefs.REASONMISLEADINGSCAM]: ATReportDefs.REASONMISLEADING,
  [ReportDefs.REASONMISLEADINGELECTIONS]: ATReportDefs.REASONMISLEADING,
  [ReportDefs.REASONMISLEADINGOTHER]: ATReportDefs.REASONMISLEADING,

  [ReportDefs.REASONRULESITESECURITY]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONRULEPROHIBITEDSALES]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONRULEBANEVASION]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONRULEOTHER]: ATReportDefs.REASONVIOLATION,

  [ReportDefs.REASONSELFHARMCONTENT]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONSELFHARMED]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONSELFHARMSTUNTS]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONSELFHARMSUBSTANCES]: ATReportDefs.REASONVIOLATION,
  [ReportDefs.REASONSELFHARMOTHER]: ATReportDefs.REASONVIOLATION,
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
