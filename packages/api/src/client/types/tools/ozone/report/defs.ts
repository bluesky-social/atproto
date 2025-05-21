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
const id = 'tools.ozone.report.defs'

export type ReasonType =
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

/** Appeal a previously taken moderation action */
export const REASONAPPEAL = `${id}#reasonAppeal`
/** Animal welfare violations */
export const REASONVIOLENCEANIMALWELFARE = `${id}#reasonViolenceAnimalWelfare`
/** Threats or incitement */
export const REASONVIOLENCETHREATS = `${id}#reasonViolenceThreats`
/** Graphic violent content */
export const REASONVIOLENCEGRAPHICCONTENT = `${id}#reasonViolenceGraphicContent`
/** Self harm */
export const REASONVIOLENCESELFHARM = `${id}#reasonViolenceSelfHarm`
/** Glorification of violence */
export const REASONVIOLENCEGLORIFICATION = `${id}#reasonViolenceGlorification`
/** Extremist content. These reports will be sent only be sent to the application's Moderation Authority. */
export const REASONVIOLENCEEXTREMISTCONTENT = `${id}#reasonViolenceExtremistContent`
/** Human trafficking */
export const REASONVIOLENCETRAFFICKING = `${id}#reasonViolenceTrafficking`
/** Other violent content */
export const REASONVIOLENCEOTHER = `${id}#reasonViolenceOther`
/** Adult sexual abuse content */
export const REASONSEXUALABUSECONTENT = `${id}#reasonSexualAbuseContent`
/** Non-consensual intimate imagery */
export const REASONSEXUALNCII = `${id}#reasonSexualNCII`
/** Sextortion */
export const REASONSEXUALSEXTORTION = `${id}#reasonSexualSextortion`
/** Deepfake adult content */
export const REASONSEXUALDEEPFAKE = `${id}#reasonSexualDeepfake`
/** Animal sexual abuse */
export const REASONSEXUALANIMAL = `${id}#reasonSexualAnimal`
/** Unlabelled adult content */
export const REASONSEXUALUNLABELED = `${id}#reasonSexualUnlabeled`
/** Other sexual violence content */
export const REASONSEXUALOTHER = `${id}#reasonSexualOther`
/** Child sexual abuse material (CSAM). These reports will be sent only be sent to the application's Moderation Authority. */
export const REASONCHILDSAFETYCSAM = `${id}#reasonChildSafetyCSAM`
/** Grooming or predatory behavior. These reports will be sent only be sent to the application's Moderation Authority. */
export const REASONCHILDSAFETYGROOM = `${id}#reasonChildSafetyGroom`
/** Privacy violation involving a minor */
export const REASONCHILDSAFETYMINORPRIVACY = `${id}#reasonChildSafetyMinorPrivacy`
/** Child endangerment. These reports will be sent only be sent to the application's Moderation Authority. */
export const REASONCHILDSAFETYENDANGERMENT = `${id}#reasonChildSafetyEndangerment`
/** Harassment or bullying of minors */
export const REASONCHILDSAFETYHARASSMENT = `${id}#reasonChildSafetyHarassment`
/** Promotion of child exploitation. These reports will be sent only be sent to the application's Moderation Authority. */
export const REASONCHILDSAFETYPROMOTION = `${id}#reasonChildSafetyPromotion`
/** Other child safety. These reports will be sent only be sent to the application's Moderation Authority. */
export const REASONCHILDSAFETYOTHER = `${id}#reasonChildSafetyOther`
/** Trolling */
export const REASONHARASSMENTTROLL = `${id}#reasonHarassmentTroll`
/** Targeted harassment */
export const REASONHARASSMENTTARGETED = `${id}#reasonHarassmentTargeted`
/** Hate speech */
export const REASONHARASSMENTHATESPEECH = `${id}#reasonHarassmentHateSpeech`
/** Doxxing */
export const REASONHARASSMENTDOXXING = `${id}#reasonHarassmentDoxxing`
/** Other harassing or hateful content */
export const REASONHARASSMENTOTHER = `${id}#reasonHarassmentOther`
/** Fake account or bot */
export const REASONMISLEADINGBOT = `${id}#reasonMisleadingBot`
/** Impersonation */
export const REASONMISLEADINGIMPERSONATION = `${id}#reasonMisleadingImpersonation`
/** Spam */
export const REASONMISLEADINGSPAM = `${id}#reasonMisleadingSpam`
/** Scam */
export const REASONMISLEADINGSCAM = `${id}#reasonMisleadingScam`
/** Unlabelled gen-AI or synthetic content */
export const REASONMISLEADINGSYNTHETICCONTENT = `${id}#reasonMisleadingSyntheticContent`
/** Harmful false claims */
export const REASONMISLEADINGMISINFORMATION = `${id}#reasonMisleadingMisinformation`
/** Other misleading content */
export const REASONMISLEADINGOTHER = `${id}#reasonMisleadingOther`
/** Hacking or system attacks */
export const REASONRULESITESECURITY = `${id}#reasonRuleSiteSecurity`
/** Stolen content */
export const REASONRULESTOLENCONTENT = `${id}#reasonRuleStolenContent`
/** Promoting or selling prohibited items or services */
export const REASONRULEPROHIBITEDSALES = `${id}#reasonRuleProhibitedSales`
/** Banned user returning */
export const REASONRULEBANEVASION = `${id}#reasonRuleBanEvasion`
/** Other */
export const REASONRULEOTHER = `${id}#reasonRuleOther`
/** Electoral process violations */
export const REASONCIVICELECTORALPROCESS = `${id}#reasonCivicElectoralProcess`
/** Disclosure & transparency violations */
export const REASONCIVICDISCLOSURE = `${id}#reasonCivicDisclosure`
/** Voter intimidation or interference */
export const REASONCIVICINTERFERENCE = `${id}#reasonCivicInterference`
/** Election misinformation */
export const REASONCIVICMISINFORMATION = `${id}#reasonCivicMisinformation`
/** Impersonation of electoral officials/entities */
export const REASONCIVICIMPERSONATION = `${id}#reasonCivicImpersonation`
