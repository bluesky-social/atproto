/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.moderation.defs'

export type ReasonType =
  | 'com.atproto.moderation.defs#reasonSpam'
  | 'com.atproto.moderation.defs#reasonViolation'
  | 'com.atproto.moderation.defs#reasonMisleading'
  | 'com.atproto.moderation.defs#reasonSexual'
  | 'com.atproto.moderation.defs#reasonRude'
  | 'com.atproto.moderation.defs#reasonOther'
  | 'com.atproto.moderation.defs#reasonAppeal'
  | 'tools.ozone.report.defs#reasonAppeal'
  | 'tools.ozone.report.defs#reasonViolenceAnimalWelfare'
  | 'tools.ozone.report.defs#reasonViolenceThreats'
  | 'tools.ozone.report.defs#reasonViolenceGraphicContent'
  | 'tools.ozone.report.defs#reasonViolenceSelfHarm'
  | 'tools.ozone.report.defs#reasonViolenceGlorification'
  | 'tools.ozone.report.defs#reasonViolenceExtremistContent'
  | 'tools.ozone.report.defs#reasonViolenceTrafficking'
  | 'tools.ozone.report.defs#reasonViolenceOther'
  | 'tools.ozone.report.defs#reasonSexualAbuseContent'
  | 'tools.ozone.report.defs#reasonSexualNCII'
  | 'tools.ozone.report.defs#reasonSexualSextortion'
  | 'tools.ozone.report.defs#reasonSexualDeepfake'
  | 'tools.ozone.report.defs#reasonSexualAnimal'
  | 'tools.ozone.report.defs#reasonSexualUnlabeled'
  | 'tools.ozone.report.defs#reasonSexualOther'
  | 'tools.ozone.report.defs#reasonChildSafetyCSAM'
  | 'tools.ozone.report.defs#reasonChildSafetyGroom'
  | 'tools.ozone.report.defs#reasonChildSafetyMinorPrivacy'
  | 'tools.ozone.report.defs#reasonChildSafetyEndangerment'
  | 'tools.ozone.report.defs#reasonChildSafetyHarassment'
  | 'tools.ozone.report.defs#reasonChildSafetyPromotion'
  | 'tools.ozone.report.defs#reasonChildSafetyOther'
  | 'tools.ozone.report.defs#reasonHarassmentTroll'
  | 'tools.ozone.report.defs#reasonHarassmentTargeted'
  | 'tools.ozone.report.defs#reasonHarassmentHateSpeech'
  | 'tools.ozone.report.defs#reasonHarassmentDoxxing'
  | 'tools.ozone.report.defs#reasonHarassmentOther'
  | 'tools.ozone.report.defs#reasonMisleadingBot'
  | 'tools.ozone.report.defs#reasonMisleadingImpersonation'
  | 'tools.ozone.report.defs#reasonMisleadingSpam'
  | 'tools.ozone.report.defs#reasonMisleadingScam'
  | 'tools.ozone.report.defs#reasonMisleadingSyntheticContent'
  | 'tools.ozone.report.defs#reasonMisleadingMisinformation'
  | 'tools.ozone.report.defs#reasonMisleadingOther'
  | 'tools.ozone.report.defs#reasonRuleSiteSecurity'
  | 'tools.ozone.report.defs#reasonRuleStolenContent'
  | 'tools.ozone.report.defs#reasonRuleProhibitedSales'
  | 'tools.ozone.report.defs#reasonRuleBanEvasion'
  | 'tools.ozone.report.defs#reasonRuleOther'
  | 'tools.ozone.report.defs#reasonCivicElectoralProcess'
  | 'tools.ozone.report.defs#reasonCivicDisclosure'
  | 'tools.ozone.report.defs#reasonCivicInterference'
  | 'tools.ozone.report.defs#reasonCivicMisinformation'
  | 'tools.ozone.report.defs#reasonCivicImpersonation'
  | (string & {})

/** Spam: frequent unwanted promotion, replies, mentions. Prefer new lexicon definition `tools.ozone.report.defs#reasonMisleadingSpam`. */
export const REASONSPAM = `${id}#reasonSpam`
/** Direct violation of server rules, laws, terms of service. Prefer new lexicon definition `tools.ozone.report.defs#reasonRuleOther`. */
export const REASONVIOLATION = `${id}#reasonViolation`
/** Misleading identity, affiliation, or content. Prefer new lexicon definition `tools.ozone.report.defs#reasonMisleadingOther`. */
export const REASONMISLEADING = `${id}#reasonMisleading`
/** Unwanted or mislabeled sexual content. Prefer new lexicon definition `tools.ozone.report.defs#reasonSexualUnlabeled`. */
export const REASONSEXUAL = `${id}#reasonSexual`
/** Rude, harassing, explicit, or otherwise unwelcoming behavior. Prefer new lexicon definition `tools.ozone.report.defs#reasonHarassmentOther`. */
export const REASONRUDE = `${id}#reasonRude`
/** Reports not falling under another report category. Prefer new lexicon definition `tools.ozone.report.defs#reasonRuleOther`. */
export const REASONOTHER = `${id}#reasonOther`
/** Appeal a previously taken moderation action */
export const REASONAPPEAL = `${id}#reasonAppeal`

/** Tag describing a type of subject that might be reported. */
export type SubjectType = 'account' | 'record' | 'chat' | (string & {})
