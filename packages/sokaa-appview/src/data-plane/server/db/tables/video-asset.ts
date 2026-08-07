export const tableName = 'video_asset'

export interface VideoAsset {
  did: string
  videoCid: string
  state: string
  streamUid: string | null
  playlistUrl: string | null
  error: string | null
  attempts: number
  updatedAt: string
}

export type PartialDB = { [tableName]: VideoAsset }
