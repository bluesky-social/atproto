import {
  AppBskyActorProfile,
  AppBskyFeedGenerator,
  AppBskyFeedPost,
  AppBskyGraphList,
} from '@atproto/api'
import { langLogger as log } from '../logger'
import { ContentTagger } from './content-tagger'
import { code3ToCode2 } from './language-data'

const ifString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined
const isStringProp = (obj: object, prop: string): string | undefined =>
  prop in obj ? ifString(obj[prop]) : undefined

export class LanguageTagger extends ContentTagger {
  tagPrefix = 'lang:'

  isApplicable(): boolean {
    return !!this.subjectStatus && !this.tagAlreadyExists()
  }

  async buildTags(): Promise<string[]> {
    try {
      const recordLangs = await this.getRecordLang()
      return recordLangs
        ? recordLangs.map((lang) => `${this.tagPrefix}${lang}`)
        : [`${this.tagPrefix}und`]
    } catch (err) {
      log.error({ subject: this.subject, err }, 'Error getting record langs')
      return []
    }
  }

  getTextFromRecord(recordValue: Record<string, unknown>): string | undefined {
    let text: string | undefined

    if (AppBskyGraphList.isRecord(recordValue)) {
      text =
        isStringProp(recordValue, 'description') ||
        isStringProp(recordValue, 'name')
    } else if (
      AppBskyFeedGenerator.isRecord(recordValue) ||
      AppBskyActorProfile.isRecord(recordValue)
    ) {
      text =
        isStringProp(recordValue, 'description') ||
        isStringProp(recordValue, 'displayName')
    } else if (AppBskyFeedPost.isRecord(recordValue)) {
      text = isStringProp(recordValue, 'text')
    }

    return text?.trim()
  }

  async getRecordLang(): Promise<string[] | null> {
    const langs = new Set<string>()

    if (
      this.subject.isRepo() ||
      (this.subject.isRecord() &&
        this.subject.uri.endsWith('/app.bsky.actor.profile/self'))
    ) {
      const feed = await this.moderationService.views.fetchAuthorFeed(
        this.subject.did,
      )
      feed.forEach((item) => {
        const itemLangs = item.post.record['langs'] as string[] | null
        if (itemLangs?.length) {
          // Pick the first fragment of the lang code so that instead of `en-US` and `en-GB` we get `en`
          itemLangs.forEach((lang) => langs.add(lang.split('-')[0]))
        }
      })
    }

    if (this.subject.isRecord()) {
      const recordByUri = await this.moderationService.views.fetchRecords([
        this.subject,
      ])
      const record = recordByUri.get(this.subject.uri)
      const recordLang = record?.value.langs as string[] | null
      const recordText = record
        ? this.getTextFromRecord(record.value)
        : undefined
      if (recordLang?.length) {
        recordLang
          .map((lang) => lang.split('-')[0])
          .forEach((lang) => langs.add(lang))
      } else if (recordText) {
        // 'lande' is an esm module, so we need to import it dynamically
        const { default: lande } = await import('lande')
        const detectedLanguages = lande(recordText)
        if (detectedLanguages.length) {
          const langCode = code3ToCode2(detectedLanguages[0][0])
          if (langCode) langs.add(langCode)
        }
      }
    }

    return langs.size > 0 ? Array.from(langs) : null
  }
}
