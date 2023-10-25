import { CID } from 'multiformats/cid'
import { AccountDb } from './db'

export const updateRoot = async (
  db: AccountDb,
  did: string,
  cid: CID,
  rev: string,
) => {
  await db.db
    .insertInto('repo_root')
    .values({
      did,
      root: cid.toString(),
      rev,
      indexedAt: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.column('did').doUpdateSet({ root: cid.toString(), rev }),
    )
    .execute()
}
