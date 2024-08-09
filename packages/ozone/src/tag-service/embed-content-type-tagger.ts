import { AppBskyEmbedImages } from '@atproto/api'
import { langLogger as log } from '../logger'
import { ContentTagger } from './content-tagger'

export class EmbedContentTypeTagger extends ContentTagger {
  tagPrefix = 'embed-content-type:'
  isApplicable(): boolean {
    return Boolean(
      this.subjectStatus &&
        this.subject.isRecord() &&
        this.subject.uri.includes('app.bsky.feed.post') &&
        !this.subjectStatus.tags?.find((tag) => tag.includes(this.tagPrefix)),
    )
  }

  async getTags(): Promise<string[]> {
    try {
      const recordValue = await this.getRecordValue()
      if (!recordValue) {
        return []
      }
      const tags: string[] = []
      if (AppBskyEmbedImages.isView(recordValue)) {
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
