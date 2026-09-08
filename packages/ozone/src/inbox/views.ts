import type { Expression, ExpressionBuilder, SqlBool } from 'kysely'
import { sql } from 'kysely'
import type { InboxConfig } from '../config/config.js'
import type { Database } from '../db/index.js'
import type { DatabaseSchemaType } from '../db/schema/index.js'
import type {
  ActionView,
  EnforcementView,
  SubjectView,
} from '../lexicon/types/tools/ozone/inbox/defs.js'
import { REASONAPPEAL } from '../lexicon/types/tools/ozone/report/defs.js'
import { SUSPEND_LABEL, TAKEDOWN_LABEL } from '../mod-service/index.js'
import type { ModSubject } from '../mod-service/subject.js'
import type {
  ModerationEventRow,
  ModerationSubjectStatusRow,
} from '../mod-service/types.js'
import type { AppealReport } from './appeal.js'
import {
  APPEALABLE_EVENT_ACTIONS,
  EMAIL,
  LABEL,
  MUTE_REPORTER,
  PUBLIC_EVENT_ACTIONS,
  REVERSE_TAKEDOWN,
  REVOKE_CREDENTIALS,
  TAKEDOWN,
  reportSubjectFilter,
  subjectLabelUri,
  toAppealState,
} from './appeal.js'

/**
 * Newest events mapped into the action history. The totals query supplies the
 * exact count and first-action date, so this cap bounds the read without making
 * either number wrong. It has to stay generous enough that a takedown and the
 * reversal undoing it normally land in the same window.
 */
const EVENT_WINDOW = 50

/** Everything one `subjectView` needs, as loaded from the database. */
export type SubjectSnapshot = {
  status: ModerationSubjectStatusRow | null
  events: ModerationEventRow[]
  /** Active, non-negated, unexpired label values on the subject. */
  labels: string[]
  /** Total public actions, exact even when `events` was capped. */
  actionCount: number
  firstActionAt: string | null
  /** Newest action the user is allowed to appeal, if any. */
  latestAppealableAt: string | null
  appealReport: AppealReport | null
  /** Latest nonempty `publicNote` from the appeal's close activities. */
  appealPublicNote: string | null
}

type EventTotals = {
  actionCount: number
  firstActionAt: string | null
  latestAppealableAt: string | null
}

const eventSubjectFilter = (
  eb: ExpressionBuilder<DatabaseSchemaType, 'moderation_event'>,
  subject: ModSubject,
): Expression<SqlBool> => {
  const {
    subjectType,
    subjectDid,
    subjectUri,
    subjectMessageId,
    subjectConvoId,
  } = subject.info()
  if (subject.isMessage()) {
    return eb.and([
      eb('subjectDid', '=', subjectDid),
      eb('subjectMessageId', '=', subjectMessageId),
      eb('subjectConvoId', '=', subjectConvoId),
    ])
  }
  if (subject.isConvo()) {
    return eb.and([
      eb('subjectDid', '=', subjectDid),
      eb('subjectConvoId', '=', subjectConvoId),
      eb('subjectMessageId', 'is', null),
    ])
  }
  if (subject.isRecord()) {
    return eb.and([
      eb('subjectDid', '=', subjectDid),
      eb('subjectUri', '=', subjectUri),
    ])
  }
  return eb.and([
    eb('subjectDid', '=', subjectDid),
    eb('subjectType', '=', subjectType),
  ])
}

/**
 * Load the public moderation state needed to hydrate one subject view.
 *
 * Only public columns are read. Event comments, `report.actionNote`, and
 * `report_activity.internalNote` are moderator-facing and never leave the
 * database on this path.
 */
export const loadSubject = async (
  db: Database,
  subject: ModSubject,
): Promise<SubjectSnapshot> => {
  const appealable = sql.join(
    APPEALABLE_EVENT_ACTIONS.map((action) => sql.lit(action)),
  )

  const [status, labelRows, events, totals, appealReport] = await Promise.all([
    db.db
      .selectFrom('moderation_subject_status')
      .where('did', '=', subject.did)
      .where('recordPath', '=', subject.recordPath ?? '')
      .where('convoId', '=', subject.convoId ?? '')
      .selectAll()
      .executeTakeFirst(),

    db.db
      .selectFrom('label')
      .where('uri', '=', subjectLabelUri(subject))
      .where('neg', '=', false)
      .where((eb) =>
        eb.or([
          eb('exp', 'is', null),
          eb('exp', '>', new Date().toISOString()),
        ]),
      )
      .select('val')
      .execute(),

    db.db
      .selectFrom('moderation_event')
      .where((eb) => eventSubjectFilter(eb, subject))
      .where('action', 'in', [...PUBLIC_EVENT_ACTIONS])
      .orderBy('id', 'desc')
      .limit(EVENT_WINDOW)
      .selectAll()
      .execute(),

    db.db
      .selectFrom('moderation_event')
      .where((eb) => eventSubjectFilter(eb, subject))
      .where('action', 'in', [...PUBLIC_EVENT_ACTIONS])
      .select([
        sql<number>`count(*) FILTER (WHERE action <> ${REVERSE_TAKEDOWN})::int`.as(
          'actionCount',
        ),
        sql<
          string | null
        >`min("createdAt") FILTER (WHERE action <> ${REVERSE_TAKEDOWN})`.as(
          'firstActionAt',
        ),
        sql<
          string | null
        >`max("createdAt") FILTER (WHERE action IN (${appealable}))`.as(
          'latestAppealableAt',
        ),
      ])
      .executeTakeFirstOrThrow() as Promise<EventTotals>,

    db.db
      .selectFrom('report')
      .where('reportType', '=', REASONAPPEAL)
      .where((eb) => reportSubjectFilter(eb, subject))
      .orderBy('id', 'desc')
      .select(['id', 'status', 'createdAt', 'closedAt'])
      .executeTakeFirst(),
  ])

  const publicNote = appealReport
    ? await db.db
        .selectFrom('report_activity')
        .where('reportId', '=', appealReport.id)
        .where('activityType', '=', 'closeActivity')
        .where('publicNote', 'is not', null)
        .where(sql<boolean>`length(trim("publicNote")) > 0`)
        .orderBy('id', 'desc')
        .select('publicNote')
        .executeTakeFirst()
    : undefined

  return {
    status: status ?? null,
    events,
    labels: labelRows.map((row) => row.val),
    actionCount: totals.actionCount,
    firstActionAt: totals.firstActionAt,
    latestAppealableAt: totals.latestAppealableAt,
    appealReport: appealReport ?? null,
    appealPublicNote: publicNote?.publicNote ?? null,
  }
}

export type SubjectViewInput = {
  subject: ModSubject
  /** DID of the moderation service the view speaks for. */
  serviceDid: string
  cfg: InboxConfig
  snapshot: SubjectSnapshot
}

export type EnforcementViewInput = {
  subject: ModSubject
  status: ModerationSubjectStatusRow | null
  /** Active, non-negated, unexpired label values on the subject. */
  labels: string[]
  /** Public action history, newest first, used only for the takedown's scope. */
  actions: ActionView[]
}

const splitVals = (vals: string | null): string[] =>
  vals?.length ? vals.split(' ').filter(Boolean) : []

/** `!takedown` and `!suspend` are already carried by the enforcement state. */
const withoutTakedownLabels = (vals: string[]): string[] =>
  vals.filter((val) => val !== TAKEDOWN_LABEL && val !== SUSPEND_LABEL)

const splitMeta = (row: ModerationEventRow, key: string): string[] => {
  const raw = row.meta?.[key]
  return typeof raw === 'string' && raw.length ? raw.split(',') : []
}

/**
 * `targetServices` names where a takedown was applied; empty means everywhere.
 * An appview-only takedown is visible in the app but leaves the record hosted,
 * which is what `app` means here.
 */
const takedownScope = (row: ModerationEventRow): ActionView['scope'] => {
  const services = splitMeta(row, 'targetServices')
  if (!services.length) return 'network'
  return services.includes('pds') ? 'network' : 'app'
}

const isAccountSubject = (row: ModerationEventRow): boolean =>
  row.subjectType === 'com.atproto.admin.defs#repoRef'

/** Public action type for one event, or null when it is not an entry. */
export const publicActionType = (row: ModerationEventRow): string | null => {
  switch (row.action) {
    case TAKEDOWN:
      if (!isAccountSubject(row)) return 'contentRemoved'
      return row.durationInHours ? 'accountSuspended' : 'accountTakedown'
    case LABEL:
      return splitVals(row.createLabelVals).length
        ? 'labelApplied'
        : 'labelRemoved'
    case EMAIL:
      return 'communicationSent'
    case MUTE_REPORTER:
      return 'reportingRestricted'
    case REVOKE_CREDENTIALS:
      return 'credentialsRevoked'
    default:
      return null
  }
}

const toActionView = (row: ModerationEventRow): ActionView | null => {
  const type = publicActionType(row)
  if (!type) return null

  const view: ActionView = {
    id: row.id,
    type,
    createdAt: row.createdAt,
  }
  if (row.expiresAt) view.expiresAt = row.expiresAt

  if (row.action === TAKEDOWN) {
    view.scope = takedownScope(row)
    const policies = splitMeta(row, 'policies')
    if (policies.length) view.policies = policies
  }
  if (row.action === EMAIL) {
    const policies = splitMeta(row, 'policies')
    if (policies.length) view.policies = policies
  }
  if (row.action === LABEL) {
    view.scope = 'app'
    const labels = withoutTakedownLabels(
      type === 'labelApplied'
        ? splitVals(row.createLabelVals)
        : splitVals(row.negateLabelVals),
    )
    if (labels.length) view.labels = labels
  }
  return view
}

/**
 * Map raw moderation events to the public action history, newest first.
 *
 * Reversals do not appear as actions. A `modEventReverseTakedown` stamps
 * `reversedAt` on the newest takedown it undoes, and a label negation does the
 * same to the `labelApplied` that put those values there - so the user sees
 * "removed, then restored" as one action with an end date rather than as two
 * unrelated events.
 */
export const toActionViews = (rows: ModerationEventRow[]): ActionView[] => {
  // Oldest first, so a reversal always meets the action it undoes.
  const ordered = [...rows].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id,
  )

  const actions: ActionView[] = []
  const openTakedowns: ActionView[] = []
  const openLabels = new Map<string, ActionView>()

  for (const row of ordered) {
    if (row.action === REVERSE_TAKEDOWN) {
      const takedown = openTakedowns.pop()
      if (takedown) takedown.reversedAt = row.createdAt
      continue
    }

    const view = toActionView(row)
    if (!view) continue
    actions.push(view)

    if (row.action === TAKEDOWN) {
      openTakedowns.push(view)
    }
    if (row.action === LABEL) {
      for (const val of withoutTakedownLabels(splitVals(row.negateLabelVals))) {
        const applied = openLabels.get(val)
        if (applied) {
          applied.reversedAt = row.createdAt
          openLabels.delete(val)
        }
      }
      for (const val of withoutTakedownLabels(splitVals(row.createLabelVals))) {
        openLabels.set(val, view)
      }
    }
  }

  return actions.reverse()
}

const TAKEDOWN_TYPES = new Set([
  'contentRemoved',
  'accountSuspended',
  'accountTakedown',
])

/**
 * Current enforcement, as a single state.
 *
 * A subject can be labeled and taken down at once, so precedence decides which
 * one `state` reports: takendown > suspended > removed > labeled > none. Which
 * of `takendown` / `suspended` / `removed` applies is a question of subject
 * type and duration, not of three separate flags - a record is `removed`, an
 * account is `takendown`, and either becomes a suspension when the takedown
 * carried a duration.
 *
 * `labels[]` carries the label values whichever state won, minus `!takedown`
 * and `!suspend`: those are written straight to the label table by the
 * takedown paths and already say what `state` says.
 */
export const toEnforcementView = ({
  subject,
  status,
  labels,
  actions,
}: EnforcementViewInput): EnforcementView => {
  const active = labels.filter(
    (val) => val !== TAKEDOWN_LABEL && val !== SUSPEND_LABEL,
  )
  const suspendUntil = status?.suspendUntil
  const temporary = !!suspendUntil && new Date(suspendUntil) > new Date()
  const enforced = !!status?.takendown || temporary

  let state: EnforcementView['state'] = 'none'
  if (enforced) {
    if (!subject.isRepo()) state = 'removed'
    else state = temporary ? 'suspended' : 'takendown'
  } else if (active.length) {
    state = 'labeled'
  }

  const view: EnforcementView = { state }
  if (state === 'none') return view

  if (state === 'labeled') {
    view.scope = 'app'
  } else {
    const takedown = actions.find(
      (action) => TAKEDOWN_TYPES.has(action.type) && !action.reversedAt,
    )
    if (takedown?.scope) view.scope = takedown.scope
    if (temporary && suspendUntil) view.expiresAt = suspendUntil
  }

  if (active.length) view.labels = active
  return view
}

const latest = (...times: (string | null | undefined)[]): string | null => {
  const known = times.filter((time): time is string => !!time)
  if (!known.length) return null
  return known.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b))
}

/**
 * Compose one `tools.ozone.inbox.defs#subjectView` from an already-loaded
 * snapshot. Pure and synchronous: every query belongs to the caller, so the
 * view rules can be read and tested without a database.
 *
 * Returns null when the subject has no moderation history at all - it has
 * never been actioned and has no status row - which is not a subject the
 * inbox has anything to say about.
 *
 * `isRead` is deliberately absent: it is a comparison against a per-section
 * read watermark, and Ozone has nowhere to store one yet. Sending a value now
 * would mean inventing the watermark.
 */
export const toSubjectView = ({
  subject,
  serviceDid,
  snapshot,
  cfg,
}: SubjectViewInput): SubjectView | null => {
  if (!snapshot.status && !snapshot.actionCount) return null

  const actions = toActionViews(snapshot.events)
  const enforcement = toEnforcementView({
    subject,
    status: snapshot.status,
    labels: snapshot.labels,
    actions,
  })
  const { view: appeal, availableActions } = toAppealState({
    subject,
    status: snapshot.status,
    report: snapshot.appealReport,
    publicNote: snapshot.appealPublicNote,
    latestAppealableAt: snapshot.latestAppealableAt,
    windowMonths: cfg.appealWindowMonths,
  })

  // The subject dates from its first action, not from whenever Ozone first
  // opened a status row for it.
  const createdAt =
    snapshot.firstActionAt ??
    snapshot.status?.createdAt ??
    new Date().toISOString()
  const updatedAt =
    latest(
      actions[0]?.createdAt,
      appeal.appealedAt,
      appeal.resolvedAt,
      snapshot.status?.updatedAt,
    ) ?? createdAt

  const view: SubjectView = {
    src: serviceDid,
    subject: subject.lex(),
    enforcement,
    appeal,
    availableActions,
    createdAt,
    updatedAt,
  }
  if (actions.length) {
    view.latestAction = actions[0]
    view.actionCount = snapshot.actionCount
  }
  return view
}

/**
 * Load a subject and compose its view: the read path in one call, for callers
 * that have a database and a subject and want the finished thing.
 */
export const hydrateSubjectView = async (
  db: Database,
  subject: ModSubject,
  serviceDid: string,
  cfg: InboxConfig,
): Promise<SubjectView | null> =>
  toSubjectView({
    subject,
    serviceDid,
    cfg,
    snapshot: await loadSubject(db, subject),
  })
