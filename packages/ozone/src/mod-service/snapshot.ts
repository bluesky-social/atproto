import Database from '../db'
import { httpLogger } from '../logger'
import { ModerationViews } from './views'

export class Snapshot {
  constructor(
    private db: Database,
    private views: ModerationViews,
  ) {}

  async fetch(did: string, uri: string | null, cid: string | null) {
    return this.db.db
      .selectFrom('snapshot')
      .selectAll()
      .where('did', '=', did)
      .where('uri', '=', uri || '')
      .where('cid', '=', cid || '')
      .executeTakeFirst()
  }

  async attempt(did: string, uri: string | null, cid: string | null) {
    try {
      const hasSnapshot = await this.hasSnapshot(did, uri, cid)
      if (hasSnapshot) return
      if (uri) {
        await this.saveRecordSnapshot(did, uri, cid)
        return
      }

      await this.saveRepoSnapshot(did)
    } catch (err) {
      console.error(err)
      // @TODO: OK to swallow this error?
      // if snapshot  fails, that shouldn't break other things so IMO this is fine
      httpLogger.error({ err, did, uri, cid }, 'Attempt to snapshot failed')
    }
  }

  async saveRepoSnapshot(did: string) {
    const repoData = await this.views.getAccoutInfosByDid([did])
    const repo = repoData.get(did)
    if (repo) {
      await this.save(did, JSON.stringify(repo), null, null)
    }
  }

  async saveRecordSnapshot(did: string, uri: string, cid: string | null) {
    const recordData = await this.views.fetchRecords([
      { uri, cid: cid || undefined },
    ])
    const record = recordData.get(uri)
    if (record) {
      await this.save(did, JSON.stringify(record), uri, cid)
    }
  }

  async save(
    did: string,
    record: string,
    uri: string | null,
    cid: string | null,
  ) {
    return this.db.db
      .insertInto('snapshot')
      .values({
        did,
        uri: uri || '',
        cid: cid || '',
        record,
        createdAt: new Date(),
      })
      .execute()
  }

  async hasSnapshot(did: string, uri: string | null, cid: string | null) {
    let checkQb = this.db.db
      .selectFrom('snapshot')
      .select('did')
      .where('did', '=', did)

    if (uri) {
      checkQb = checkQb.where('uri', '=', uri)
    }

    if (cid) {
      checkQb = checkQb.where('cid', '=', cid)
    }

    const doesExist = await checkQb.executeTakeFirst()
    return !!doesExist
  }
}
