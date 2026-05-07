import { Cid, currentDatetimeString } from '@atproto/lex'
import { AccountDb } from '../db'

export const updateRoot = async (
  db: AccountDb,
  did: string,
  cid: Cid,
  rev: string,
) => {
  // @TODO balance risk of a race in the case of a long retry
  await db.executeWithRetry(
    db.db
      .insertInto('repo_root')
      .values({
        did,
        cid: cid.toString(),
        rev,
        indexedAt: currentDatetimeString(),
      })
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({ cid: cid.toString(), rev }),
      ),
  )
}
