import { CID } from 'multiformats/cid'
import { AccountDb } from '../db'

export const updateRoot = async (
  db: AccountDb,
  did: string,
  cid: CID,
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
        indexedAt: new Date().toISOString(),
      })
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({ cid: cid.toString(), rev }),
      ),
  )
}
