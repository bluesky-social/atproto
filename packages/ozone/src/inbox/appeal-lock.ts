import { sql } from 'kysely'
import type { Database } from '../db/index.js'
import type { ModSubject } from '../mod-service/subject.js'

export function appealSubjectKey(subject: {
  did: string
  recordPath: string
  subjectMessageId: string | null
  subjectConvoId: string | null
}): string {
  if (subject.subjectMessageId !== null)
    return `message:${subject.did}:${subject.subjectConvoId}:${subject.subjectMessageId}`
  if (subject.subjectConvoId !== null)
    return `convo:${subject.did}:${subject.subjectConvoId}`
  if (subject.recordPath) return `record:${subject.did}:${subject.recordPath}`
  return `account:${subject.did}`
}

export function subjectKey(subject: ModSubject): string {
  const { subjectDid, subjectMessageId, subjectConvoId } = subject.info()
  return appealSubjectKey({
    did: subjectDid,
    recordPath: subject.recordPath ?? '',
    subjectMessageId,
    subjectConvoId,
  })
}

export async function lockAppealSubject(dbTxn: Database, key: string) {
  dbTxn.assertTransaction()
  await sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(
    dbTxn.db,
  )
}
