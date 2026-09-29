import { app } from '../lexicons/index.js'
import { langLogger as log } from '../logger.js'
import { ContentTagger } from './content-tagger.js'

export class EmbedTagger extends ContentTagger {
  tagPrefix = 'embed:'

  isApplicable(): boolean {
    return (
      !!this.subjectStatus &&
      !this.tagAlreadyExists() &&
      this.subject.isRecord() &&
      this.subject.parsedUri.collection === app.bsky.feed.post.$nsid
    )
  }

  async buildTags(): Promise<string[]> {
    try {
      const recordValue = await this.getRecordValue()
      if (!recordValue) {
        return []
      }
      const tags: string[] = []
      const result = app.bsky.feed.post.main.$safeParse(recordValue)

      if (result.success) {
        const embed = result.value.embed
        const embedContent =
          embed && app.bsky.embed.recordWithMedia.main.$isTypeOf(embed)
            ? embed.media
            : embed

        if (
          embedContent &&
          app.bsky.embed.images.main.$isTypeOf(embedContent)
        ) {
          tags.push(`${this.tagPrefix}image`)
        }

        if (embedContent && app.bsky.embed.video.main.$isTypeOf(embedContent)) {
          tags.push(`${this.tagPrefix}video`)
        }

        if (
          embedContent &&
          app.bsky.embed.external.main.$isTypeOf(embedContent)
        ) {
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
