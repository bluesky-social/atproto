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
import type * as ToolsOzoneTeamDefs from '../team/defs.js'
import type * as ToolsOzoneModerationDefs from '../moderation/defs.js'
import type * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs.js'
import type * as ToolsOzoneQueueDefs from '../queue/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.report.defs'

export type ReasonType =
  | 'tools.ozone.report.defs#reasonAppeal'
  | 'tools.ozone.report.defs#reasonOther'
  | 'tools.ozone.report.defs#reasonViolenceAnimal'
  | 'tools.ozone.report.defs#reasonViolenceThreats'
  | 'tools.ozone.report.defs#reasonViolenceGraphicContent'
  | 'tools.ozone.report.defs#reasonViolenceGlorification'
  | 'tools.ozone.report.defs#reasonViolenceExtremistContent'
  | 'tools.ozone.report.defs#reasonViolenceTrafficking'
  | 'tools.ozone.report.defs#reasonViolenceOther'
  | 'tools.ozone.report.defs#reasonSexualAbuseContent'
  | 'tools.ozone.report.defs#reasonSexualNCII'
  | 'tools.ozone.report.defs#reasonSexualDeepfake'
  | 'tools.ozone.report.defs#reasonSexualAnimal'
  | 'tools.ozone.report.defs#reasonSexualUnlabeled'
  | 'tools.ozone.report.defs#reasonSexualOther'
  | 'tools.ozone.report.defs#reasonChildSafetyCSAM'
  | 'tools.ozone.report.defs#reasonChildSafetyGroom'
  | 'tools.ozone.report.defs#reasonChildSafetyPrivacy'
  | 'tools.ozone.report.defs#reasonChildSafetyHarassment'
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
  | 'tools.ozone.report.defs#reasonMisleadingElections'
  | 'tools.ozone.report.defs#reasonMisleadingOther'
  | 'tools.ozone.report.defs#reasonRuleSiteSecurity'
  | 'tools.ozone.report.defs#reasonRuleProhibitedSales'
  | 'tools.ozone.report.defs#reasonRuleBanEvasion'
  | 'tools.ozone.report.defs#reasonRuleOther'
  | 'tools.ozone.report.defs#reasonSelfHarmContent'
  | 'tools.ozone.report.defs#reasonSelfHarmED'
  | 'tools.ozone.report.defs#reasonSelfHarmStunts'
  | 'tools.ozone.report.defs#reasonSelfHarmSubstances'
  | 'tools.ozone.report.defs#reasonSelfHarmOther'
  | (string & {})

/** Appeal a previously taken moderation action */
export const REASONAPPEAL = `${id}#reasonAppeal`
/** An issue not included in these options */
export const REASONOTHER = `${id}#reasonOther`
/** Animal welfare violations */
export const REASONVIOLENCEANIMAL = `${id}#reasonViolenceAnimal`
/** Threats or incitement */
export const REASONVIOLENCETHREATS = `${id}#reasonViolenceThreats`
/** Graphic violent content */
export const REASONVIOLENCEGRAPHICCONTENT = `${id}#reasonViolenceGraphicContent`
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
export const REASONCHILDSAFETYPRIVACY = `${id}#reasonChildSafetyPrivacy`
/** Harassment or bullying of minors */
export const REASONCHILDSAFETYHARASSMENT = `${id}#reasonChildSafetyHarassment`
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
/** False information about elections */
export const REASONMISLEADINGELECTIONS = `${id}#reasonMisleadingElections`
/** Other misleading content */
export const REASONMISLEADINGOTHER = `${id}#reasonMisleadingOther`
/** Hacking or system attacks */
export const REASONRULESITESECURITY = `${id}#reasonRuleSiteSecurity`
/** Promoting or selling prohibited items or services */
export const REASONRULEPROHIBITEDSALES = `${id}#reasonRuleProhibitedSales`
/** Banned user returning */
export const REASONRULEBANEVASION = `${id}#reasonRuleBanEvasion`
/** Other */
export const REASONRULEOTHER = `${id}#reasonRuleOther`
/** Content promoting or depicting self-harm */
export const REASONSELFHARMCONTENT = `${id}#reasonSelfHarmContent`
/** Eating disorders */
export const REASONSELFHARMED = `${id}#reasonSelfHarmED`
/** Dangerous challenges or activities */
export const REASONSELFHARMSTUNTS = `${id}#reasonSelfHarmStunts`
/** Dangerous substances or drug abuse */
export const REASONSELFHARMSUBSTANCES = `${id}#reasonSelfHarmSubstances`
/** Other dangerous content */
export const REASONSELFHARMOTHER = `${id}#reasonSelfHarmOther`

/** Information about the moderator currently assigned to a report. */
export interface ReportAssignment {
  $type?: 'tools.ozone.report.defs#reportAssignment'
  /** DID of the assigned moderator */
  did: string
  moderator?: ToolsOzoneTeamDefs.Member
  /** When the report was assigned */
  assignedAt: string
}

const hashReportAssignment = 'reportAssignment'

export function isReportAssignment<V>(v: V) {
  return is$typed(v, id, hashReportAssignment)
}

export function validateReportAssignment<V>(v: V) {
  return validate<ReportAssignment & V>(v, id, hashReportAssignment)
}

export interface ReportView {
  $type?: 'tools.ozone.report.defs#reportView'
  /** Report ID */
  id: number
  /** ID of the moderation event that created this report */
  eventId: number
  /** Current status of the report */
  status:
    | 'open'
    | 'closed'
    | 'escalated'
    | 'queued'
    | 'assigned'
    | (string & {})
  subject: ToolsOzoneModerationDefs.SubjectView
  reportType: ComAtprotoModerationDefs.ReasonType
  /** DID of the user who made the report */
  reportedBy: string
  reporter: ToolsOzoneModerationDefs.SubjectView
  /** Comment provided by the reporter */
  comment?: string
  /** When the report was created */
  createdAt: string
  /** When the report was last updated */
  updatedAt?: string
  /** When the report was assigned to its current queue */
  queuedAt?: string
  /** Array of moderation event IDs representing actions taken on this report (sorted DESC, most recent first) */
  actionEventIds?: number[]
  /** Optional: expanded action events */
  actions?: ToolsOzoneModerationDefs.ModEventView[]
  /** Note sent to reporter when report was actioned */
  actionNote?: string
  subjectStatus?: ToolsOzoneModerationDefs.SubjectStatusView
  /** Number of other pending reports on the same subject */
  relatedReportCount?: number
  assignment?: ReportAssignment
  queue?: ToolsOzoneQueueDefs.QueueView
}

const hashReportView = 'reportView'

export function isReportView<V>(v: V) {
  return is$typed(v, id, hashReportView)
}

export function validateReportView<V>(v: V) {
  return validate<ReportView & V>(v, id, hashReportView)
}

/** Activity recording a report being routed to a queue. */
export interface QueueActivity {
  $type?: 'tools.ozone.report.defs#queueActivity'
  /** The report's status before this activity. Populated automatically from the report row; not required in input. */
  previousStatus?:
    | 'open'
    | 'closed'
    | 'escalated'
    | 'queued'
    | 'assigned'
    | (string & {})
}

const hashQueueActivity = 'queueActivity'

export function isQueueActivity<V>(v: V) {
  return is$typed(v, id, hashQueueActivity)
}

export function validateQueueActivity<V>(v: V) {
  return validate<QueueActivity & V>(v, id, hashQueueActivity)
}

/** Activity recording a moderator being assigned to a report. */
export interface AssignmentActivity {
  $type?: 'tools.ozone.report.defs#assignmentActivity'
  /** The report's status before this activity. Populated automatically from the report row; not required in input. */
  previousStatus?:
    | 'open'
    | 'closed'
    | 'escalated'
    | 'queued'
    | 'assigned'
    | (string & {})
}

const hashAssignmentActivity = 'assignmentActivity'

export function isAssignmentActivity<V>(v: V) {
  return is$typed(v, id, hashAssignmentActivity)
}

export function validateAssignmentActivity<V>(v: V) {
  return validate<AssignmentActivity & V>(v, id, hashAssignmentActivity)
}

/** Activity recording a report being escalated. */
export interface EscalationActivity {
  $type?: 'tools.ozone.report.defs#escalationActivity'
  /** The report's status before this activity. Populated automatically from the report row; not required in input. */
  previousStatus?:
    | 'open'
    | 'closed'
    | 'escalated'
    | 'queued'
    | 'assigned'
    | (string & {})
}

const hashEscalationActivity = 'escalationActivity'

export function isEscalationActivity<V>(v: V) {
  return is$typed(v, id, hashEscalationActivity)
}

export function validateEscalationActivity<V>(v: V) {
  return validate<EscalationActivity & V>(v, id, hashEscalationActivity)
}

/** Activity recording a report being closed. */
export interface CloseActivity {
  $type?: 'tools.ozone.report.defs#closeActivity'
  /** The report's status before this activity. Populated automatically from the report row; not required in input. */
  previousStatus?:
    | 'open'
    | 'closed'
    | 'escalated'
    | 'queued'
    | 'assigned'
    | (string & {})
}

const hashCloseActivity = 'closeActivity'

export function isCloseActivity<V>(v: V) {
  return is$typed(v, id, hashCloseActivity)
}

export function validateCloseActivity<V>(v: V) {
  return validate<CloseActivity & V>(v, id, hashCloseActivity)
}

/** Activity recording a closed report being reopened. Only valid when the report is in 'closed' status. */
export interface ReopenActivity {
  $type?: 'tools.ozone.report.defs#reopenActivity'
  /** The report's status before this activity. Populated automatically from the report row; not required in input. */
  previousStatus?:
    | 'open'
    | 'closed'
    | 'escalated'
    | 'queued'
    | 'assigned'
    | (string & {})
}

const hashReopenActivity = 'reopenActivity'

export function isReopenActivity<V>(v: V) {
  return is$typed(v, id, hashReopenActivity)
}

export function validateReopenActivity<V>(v: V) {
  return validate<ReopenActivity & V>(v, id, hashReopenActivity)
}

/** Activity recording a note on a report. Use internalNote for moderator-only notes or publicNote for reporter-visible notes (or both). */
export interface NoteActivity {
  $type?: 'tools.ozone.report.defs#noteActivity'
}

const hashNoteActivity = 'noteActivity'

export function isNoteActivity<V>(v: V) {
  return is$typed(v, id, hashNoteActivity)
}

export function validateNoteActivity<V>(v: V) {
  return validate<NoteActivity & V>(v, id, hashNoteActivity)
}

/** A single activity entry on a report. */
export interface ReportActivityView {
  $type?: 'tools.ozone.report.defs#reportActivityView'
  /** Activity ID */
  id: number
  /** ID of the report this activity belongs to */
  reportId: number
  activity:
    | $Typed<QueueActivity>
    | $Typed<AssignmentActivity>
    | $Typed<EscalationActivity>
    | $Typed<CloseActivity>
    | $Typed<ReopenActivity>
    | $Typed<NoteActivity>
    | { $type: string }
  /** Optional moderator-only note. Not visible to reporters. */
  internalNote?: string
  /** Optional public note, potentially visible to the reporter. */
  publicNote?: string
  /** Extensible JSON payload for loose activity-specific metadata (e.g. assignmentId). */
  meta?: { [_ in string]: unknown }
  /** True if this activity was created by an automated process (e.g. queue router) rather than a direct human action. */
  isAutomated: boolean
  /** DID of the actor who created this activity, or the service DID for automated activities. */
  createdBy: string
  moderator?: ToolsOzoneTeamDefs.Member
  /** When this activity was created */
  createdAt: string
}

const hashReportActivityView = 'reportActivityView'

export function isReportActivityView<V>(v: V) {
  return is$typed(v, id, hashReportActivityView)
}

export function validateReportActivityView<V>(v: V) {
  return validate<ReportActivityView & V>(v, id, hashReportActivityView)
}

export interface AssignmentView {
  $type?: 'tools.ozone.report.defs#assignmentView'
  id: number
  did: string
  moderator?: ToolsOzoneTeamDefs.Member
  queue?: ToolsOzoneQueueDefs.QueueView
  reportId: number
  startAt: string
  endAt?: string
}

const hashAssignmentView = 'assignmentView'

export function isAssignmentView<V>(v: V) {
  return is$typed(v, id, hashAssignmentView)
}

export function validateAssignmentView<V>(v: V) {
  return validate<AssignmentView & V>(v, id, hashAssignmentView)
}
