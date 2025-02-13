import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  AppBskyFeedPost,
} from '@atproto/api'
import { ids } from '../lexicon/lexicons'
import { langLogger as log } from '../logger'
import { ContentTagger } from './content-tagger'

export class EmbedTagger extends ContentTagger {
  tagPrefix = 'embed:'

  isApplicable(): boolean {
    return (
      !!this.subjectStatus &&
      !this.tagAlreadyExists() &&
      this.subject.isRecord() &&
      this.subject.parsedUri.collection === ids.AppBskyFeedPost
    )
  }

  async buildTags(): Promise<string[]> {
    try {
      const recordValue = await this.getRecordValue()
      if (!recordValue) {
        return []
      }
      const tags: string[] = []
      const result = AppBskyFeedPost.validateRecord(recordValue)

      if (result.success) {
        const embedContent = AppBskyEmbedRecordWithMedia.isMain(
          result.value.embed,
        )
          ? result.value.embed.media
          : result.value.embed

        if (AppBskyEmbedImages.isMain(embedContent)) {
          tags.push(`${this.tagPrefix}image`)
        }

        if (AppBskyEmbedVideo.isMain(embedContent)) {
          tags.push(`${this.tagPrefix}video`)
        }

        if (AppBskyEmbedExternal.isMain(embedContent)) {
          tags.push(`${this.tagPrefix}external`)
        }
      }
      return tags
    } catch (err) {
      log.error({ subject: this.subject, err }, 'Error getting record langs')
      return []
    }
  }

  async getRecordValue(): Promise<Record<string, unknown> | undefined> {
    if (!this.subject.isRecord()) {
      return undefined
    }
    const recordByUri = await this.moderationService.views.fetchRecords([
      this.subject,
    ])

    const record = recordByUri.get(this.subject.uri)
    return record?.value
  }
}
