import { AdxUri } from '@adxp/common'
import { DataDiff, Repo } from '@adxp/repo'
import Database from './db'

export const processDiff = async (
  db: Database,
  repo: Repo,
  diff: DataDiff,
): Promise<void> => {
  const did = repo.did()
  const adds = diff.addList().map(async (add) => {
    const loaded = await repo.blockstore.getUnchecked(add.cid)
    const uri = new AdxUri(`${did}/${add.key}`)
    await db.indexRecord(uri, loaded)
  })
  const updates = diff.updateList().map(async (update) => {
    const loaded = await repo.blockstore.getUnchecked(update.cid)
    const uri = new AdxUri(`${did}/${update.key}`)
    await db.indexRecord(uri, loaded)
  })
  const deletes = diff.deleteList().map(async (del) => {
    const uri = new AdxUri(`${did}/${del.key}`)
    await db.deleteRecord(uri)
  })

  await Promise.all([...adds, ...updates, ...deletes])

  // @TODO notify subscribers
}
