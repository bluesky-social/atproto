import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { WriteOpAction } from '@atproto/repo'
import { dbLogger as log } from '../../logger'
import { Backlink } from '../actor-db'
import { RecordReader, getBacklinks } from './reader'

export class RecordTransactor extends RecordReader {
  async indexRecord(
    uri: AtUri,
    cid: CID,
    obj: unknown,
    action: WriteOpAction.Create | WriteOpAction.Update = WriteOpAction.Create,
    repoRev?: string,
    timestamp?: string,
  ) {
    this.db.assertTransaction()
    log.debug({ uri }, 'indexing record')
    const record = {
      uri: uri.toString(),
      cid: cid.toString(),
      did: uri.host,
      collection: uri.collection,
      rkey: uri.rkey,
      repoRev: repoRev ?? null,
      indexedAt: timestamp || new Date().toISOString(),
    }
    if (!record.did.startsWith('did:')) {
      throw new Error('Expected indexed URI to contain DID')
    } else if (record.collection.length < 1) {
      throw new Error('Expected indexed URI to contain a collection')
    } else if (record.rkey.length < 1) {
      throw new Error('Expected indexed URI to contain a record key')
    }

    // Track current version of record
    await this.db.db
      .insertInto('record')
      .values(record)
      .onConflict((oc) =>
        oc.column('uri').doUpdateSet({
          cid: record.cid,
          repoRev: repoRev ?? null,
          indexedAt: record.indexedAt,
        }),
      )
      .execute()

    // Maintain backlinks
    const backlinks = getBacklinks(uri, obj)
    if (action === WriteOpAction.Update) {
      // On update just recreate backlinks from scratch for the record, so we can clear out
      // the old ones. E.g. for weird cases like updating a follow to be for a different did.
      await this.removeBacklinksByUri(uri)
    }
    await this.addBacklinks(backlinks)

    log.info({ uri }, 'indexed record')
  }

  async deleteRecord(uri: AtUri) {
    this.db.assertTransaction()
    log.debug({ uri }, 'deleting indexed record')
    const deleteQuery = this.db.db
      .deleteFrom('record')
      .where('uri', '=', uri.toString())
    const backlinkQuery = this.db.db
      .deleteFrom('backlink')
      .where('uri', '=', uri.toString())
    await Promise.all([deleteQuery.execute(), backlinkQuery.execute()])

    log.info({ uri }, 'deleted indexed record')
  }

  async deleteForActor(_did: string) {
    // Not done in transaction because it would be too long, prone to contention.
    // Also, this can safely be run multiple times if it fails.
    await this.db.db.deleteFrom('record').execute()
  }

  async removeBacklinksByUri(uri: AtUri) {
    await this.db.db
      .deleteFrom('backlink')
      .where('uri', '=', uri.toString())
      .execute()
  }

  async addBacklinks(backlinks: Backlink[]) {
    if (backlinks.length === 0) return
    await this.db.db
      .insertInto('backlink')
      .values(backlinks)
      .onConflict((oc) => oc.doNothing())
      .execute()
  }
}
