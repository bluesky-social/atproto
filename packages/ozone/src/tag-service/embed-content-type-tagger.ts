import { AppBskyEmbedImages, AppBskyEmbedRecordWithMedia } from '@atproto/api'
import { langLogger as log } from '../logger'
import { ContentTagger } from './content-tagger'
import { ids } from '../lexicon/lexicons'

export class EmbedContentTypeTagger extends ContentTagger {
  tagPrefix = 'embed-content-type:'

  isApplicable(): boolean {
    return (
      !this.tagAlreadyExists() &&
      this.subject.isRecord() &&
      this.subject.parsedUri.collection === ids.AppBskyFeedPost
    )
  }

  async getTags(): Promise<string[]> {
    try {
      if (!this.isApplicable()) {
        return []
      }
      const recordValue = await this.getRecordValue()
      if (!recordValue) {
        return []
      }
      const tags: string[] = []
      if (
        AppBskyEmbedImages.isView(recordValue) &&
        (AppBskyEmbedImages.isMain(recordValue.embed) ||
          AppBskyEmbedRecordWithMedia.isMain(recordValue.embed))
      ) {
        tags.push(`${this.tagPrefix}image`)
      }
      //     @TODO: check for video embed here
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
