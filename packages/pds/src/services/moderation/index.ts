import { CID } from 'multiformats/cid'
import { BlobStore } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import Database from '../../db'
import {
  RepoBlobRef,
  RepoRef,
  StatusAttr,
} from '../../lexicon/types/com/atproto/admin/defs'
import { Main as StrongRef } from '../../lexicon/types/com/atproto/repo/strongRef'

export class ModerationService {
  constructor(public db: Database, public blobstore: BlobStore) {}

  static creator(blobstore: BlobStore) {
    return (db: Database) => new ModerationService(db, blobstore)
  }

  async getRepoTakedownState(
    did: string,
  ): Promise<StatusResponse<RepoRef> | null> {
    const res = await this.db.db
      .selectFrom('repo_root')
      .select('takedownId')
      .where('did', '=', did)
      .executeTakeFirst()
    if (!res) return null
    const state = takedownIdToStatus(res.takedownId ?? null)
    return {
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: did,
      },
      takedown: state,
    }
  }

  async getRecordTakedownState(
    uri: AtUri,
  ): Promise<StatusResponse<StrongRef> | null> {
    const res = await this.db.db
      .selectFrom('record')
      .select(['takedownId', 'cid'])
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    if (!res) return null
    const state = takedownIdToStatus(res.takedownId ?? null)
    return {
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: uri.toString(),
        cid: res.cid,
      },
      takedown: state,
    }
  }

  async getBlobTakedownState(
    did: string,
    cid: CID,
  ): Promise<StatusResponse<RepoBlobRef> | null> {
    const res = await this.db.db
      .selectFrom('repo_blob')
      .select('takedownId')
      .where('did', '=', did)
      .where('cid', '=', cid.toString())
      .executeTakeFirst()
    if (!res) return null
    const state = takedownIdToStatus(res.takedownId ?? null)
    return {
      subject: {
        $type: 'com.atproto.admin.defs#repoBlobRef',
        did: did,
        cid: cid.toString(),
      },
      takedown: state,
    }
  }

  async updateRepoTakedownState(did: string, takedown: StatusAttr) {
    const takedownId = statusToTakedownId(takedown)
    await this.db.db
      .updateTable('repo_root')
      .set({ takedownId })
      .where('did', '=', did)
      .execute()
  }

  async updateRecordTakedownState(uri: AtUri, takedown: StatusAttr) {
    const takedownId = statusToTakedownId(takedown)
    await this.db.db
      .updateTable('record')
      .set({ takedownId })
      .where('uri', '=', uri.toString())
      .execute()
  }

  async updateBlobTakedownState(did: string, blob: CID, takedown: StatusAttr) {
    const takedownId = statusToTakedownId(takedown)
    await this.db.db
      .updateTable('repo_blob')
      .set({ takedownId })
      .where('did', '=', did)
      .where('cid', '=', blob.toString())
      .execute()
    if (takedown.applied) {
      await this.blobstore.quarantine(blob)
    } else {
      await this.blobstore.unquarantine(blob)
    }
  }
}

type StatusResponse<T> = {
  subject: T
  takedown: StatusAttr
}

const takedownIdToStatus = (id: string | null): StatusAttr => {
  return id === null ? { applied: false } : { applied: true, ref: id }
}

const statusToTakedownId = (state: StatusAttr): string | null => {
  return state.applied ? state.ref ?? new Date().toISOString() : null
}
