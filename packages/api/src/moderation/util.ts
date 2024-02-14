import { AppBskyEmbedRecord, AppBskyEmbedRecordWithMedia } from '../client'

export function isQuotedPost(embed: unknown): embed is AppBskyEmbedRecord.View {
  return Boolean(embed && AppBskyEmbedRecord.isView(embed))
}

export function isQuotedPostWithMedia(
  embed: unknown,
): embed is AppBskyEmbedRecordWithMedia.View {
  return Boolean(embed && AppBskyEmbedRecordWithMedia.isView(embed))
}
