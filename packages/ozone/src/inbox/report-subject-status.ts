import { currentDatetimeString } from '@atproto/lex-schema'
import type { Database } from '../db/index.js'
import type { tools } from '../lexicons/index.js'
import type { ModSubject } from '../mod-service/subject.js'

/** Read current account and record state without loading moderation history. */
export async function loadReportSubjectStatuses(
  db: Database,
  subject: ModSubject,
) {
  if (!subject.isRepo() && !subject.isRecord()) return {}

  const recordPath = subject.isRecord() ? subject.recordPath : ''
  const rows = await db.db
    .selectFrom('moderation_subject_status')
    .select(['recordPath', 'takendown', 'suspendUntil', 'hostingStatus'])
    .where('did', '=', subject.did)
    .where('convoId', '=', '')
    .where('recordPath', 'in', recordPath ? ['', recordPath] : [''])
    .execute()
  const account = rows.find((row) => row.recordPath === '')
  const record = recordPath
    ? rows.find((row) => row.recordPath === recordPath)
    : undefined

  let accountStatus: tools.ozone.inbox.getReport.AccountStatus | undefined
  if (account) {
    // @NOTE Timed takedowns stay suspensions until their reversal is processed.
    const suspended =
      !!account.suspendUntil &&
      (account.takendown || account.suspendUntil > currentDatetimeString())
    accountStatus = {
      enforcement: suspended
        ? 'suspended'
        : account.takendown
          ? 'takendown'
          : 'none',
    }
    const hosting =
      account.hostingStatus === 'tombstoned' ? 'deleted' : account.hostingStatus
    if (
      hosting &&
      ['active', 'deleted', 'deactivated', 'suspended', 'takendown'].includes(
        hosting,
      )
    ) {
      accountStatus.hosting = hosting
    }
  }

  let subjectStatus: tools.ozone.inbox.getReport.RecordStatus | undefined
  if (record) {
    subjectStatus = {
      removed:
        record.takendown ||
        (!!record.suspendUntil &&
          record.suspendUntil > currentDatetimeString()),
    }
    if (record.hostingStatus === 'deleted') subjectStatus.deleted = true
    else if (record.hostingStatus === 'active') subjectStatus.deleted = false
  }
  return { accountStatus, subjectStatus }
}
