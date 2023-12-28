import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import { PrimaryDatabase } from '../../db'
import { ImageUriBuilder } from '../../image/uri'
import { ImageInvalidator } from '../../image/invalidator'
import { StatusAttr } from '../../lexicon/types/com/atproto/admin/defs'

export class ModerationService {
  constructor(
    public db: PrimaryDatabase,
    public imgUriBuilder: ImageUriBuilder,
    public imgInvalidator: ImageInvalidator,
  ) {}

  static creator(
    imgUriBuilder: ImageUriBuilder,
    imgInvalidator: ImageInvalidator,
  ) {
    return (db: PrimaryDatabase) =>
      new ModerationService(db, imgUriBuilder, imgInvalidator)
  }

  async takedownRepo(info: { takedownRef: string; did: string }) {
    const { takedownRef, did } = info
    await this.db.db
      .updateTable('actor')
      .set({ takedownRef })
      .where('did', '=', did)
      .where('takedownRef', 'is', null)
      .executeTakeFirst()
  }

  async reverseTakedownRepo(info: { did: string }) {
    await this.db.db
      .updateTable('actor')
      .set({ takedownRef: null })
      .where('did', '=', info.did)
      .execute()
  }

  async takedownRecord(info: { takedownRef: string; uri: AtUri; cid: CID }) {
    const { takedownRef, uri } = info
    await this.db.db
      .updateTable('record')
      .set({ takedownRef })
      .where('uri', '=', uri.toString())
      .where('takedownRef', 'is', null)
      .executeTakeFirst()
  }

  async reverseTakedownRecord(info: { uri: AtUri }) {
    await this.db.db
      .updateTable('record')
      .set({ takedownRef: null })
      .where('uri', '=', info.uri.toString())
      .execute()
  }

  async takedownBlob(info: { takedownRef: string; did: string; cid: string }) {
    const { takedownRef, did, cid } = info
    await this.db.db
      .insertInto('blob_takedown')
      .values({ did, cid, takedownRef })
      .onConflict((oc) => oc.doNothing())
      .execute()
    const paths = ImageUriBuilder.presets.map((id) => {
      const imgUri = this.imgUriBuilder.getPresetUri(id, did, cid)
      return imgUri.replace(this.imgUriBuilder.endpoint, '')
    })
    await this.imgInvalidator.invalidate(cid.toString(), paths)
  }

  async reverseTakedownBlob(info: { did: string; cid: string }) {
    const { did, cid } = info
    await this.db.db
      .deleteFrom('blob_takedown')
      .where('did', '=', did)
      .where('cid', '=', cid)
      .execute()
  }

  async getRepoTakedownRef(did: string): Promise<StatusAttr | null> {
    const res = await this.db.db
      .selectFrom('actor')
      .where('did', '=', did)
      .selectAll()
      .executeTakeFirst()
    return res ? formatStatus(res.takedownRef) : null
  }

  async getRecordTakedownRef(uri: string): Promise<StatusAttr | null> {
    const res = await this.db.db
      .selectFrom('record')
      .where('uri', '=', uri)
      .selectAll()
      .executeTakeFirst()
    return res ? formatStatus(res.takedownRef) : null
  }

  async getBlobTakedownRef(
    did: string,
    cid: string,
  ): Promise<StatusAttr | null> {
    const res = await this.db.db
      .selectFrom('blob_takedown')
      .where('did', '=', did)
      .where('cid', '=', cid)
      .selectAll()
      .executeTakeFirst()
    // this table only tracks takedowns not all blobs
    // so if no result is returned then the blob is not taken down (rather than not found)
    return formatStatus(res?.takedownRef ?? null)
  }
}

const formatStatus = (ref: string | null): StatusAttr => {
  return ref ? { applied: true, ref } : { applied: false }
}
