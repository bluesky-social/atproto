import { Database } from '../db'

export async function initJobCursor(db: Database, job: string): Promise<void> {
  await db.db
    .insertInto('job_cursor')
    .values({ job, cursor: null })
    .onConflict((oc) => oc.doNothing())
    .execute()
}

export async function getJobCursor(
  db: Database,
  job: string,
): Promise<string | null> {
  const entry = await db.db
    .selectFrom('job_cursor')
    .select('cursor')
    .where('job', '=', job)
    .executeTakeFirst()
  return entry?.cursor ?? null
}

export async function updateJobCursor(
  db: Database,
  job: string,
  cursor: string,
): Promise<void> {
  await db.db
    .updateTable('job_cursor')
    .set({ cursor })
    .where('job', '=', job)
    .execute()
}
