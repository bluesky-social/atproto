import type { AssetStore, VideoAssetRecord } from '@atproto/video-processing'
import { Database } from '../data-plane/server/db'

export class DbVideoAssetStore implements AssetStore {
  constructor(private db: Database) {}

  async get(
    did: string,
    videoCid: string,
  ): Promise<VideoAssetRecord | undefined> {
    const row = await this.db.db
      .selectFrom('video_asset')
      .selectAll()
      .where('did', '=', did)
      .where('videoCid', '=', videoCid)
      .executeTakeFirst()
    if (!row) return
    return {
      did: row.did,
      videoCid: row.videoCid,
      state: row.state as VideoAssetRecord['state'],
      streamUid: row.streamUid ?? undefined,
      playlistUrl: row.playlistUrl ?? undefined,
      error: (row.error as VideoAssetRecord['error']) ?? undefined,
      attempts: row.attempts,
      updatedAt: row.updatedAt,
    }
  }

  async put(record: VideoAssetRecord): Promise<VideoAssetRecord> {
    await this.db.db
      .insertInto('video_asset')
      .values({
        did: record.did,
        videoCid: record.videoCid,
        state: record.state,
        streamUid: record.streamUid ?? null,
        playlistUrl: record.playlistUrl ?? null,
        error: record.error ?? null,
        attempts: record.attempts,
        updatedAt: record.updatedAt,
      })
      .onConflict((oc) =>
        oc.columns(['did', 'videoCid']).doUpdateSet({
          state: record.state,
          streamUid: record.streamUid ?? null,
          playlistUrl: record.playlistUrl ?? null,
          error: record.error ?? null,
          attempts: record.attempts,
          updatedAt: record.updatedAt,
        }),
      )
      .execute()
    return record
  }
}
