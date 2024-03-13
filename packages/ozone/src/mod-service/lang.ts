import lande from 'lande'

import { ModerationService } from '.'
import { ModSubject } from './subject'
import { ModerationSubjectStatusRow } from './types'
import { langLogger as log } from '../logger'
import { code3ToCode2 } from './lang-data'
import { AtUri } from '@atproto/syntax'
import { ids } from '../lexicon/lexicons'

export class ModerationLangService {
  constructor(private moderationService: ModerationService) {}

  async tagSubjectWithLang({
    subject,
    subjectStatus,
    createdBy,
  }: {
    subject: ModSubject
    createdBy: string
    subjectStatus: ModerationSubjectStatusRow | null
  }) {
    if (
      subjectStatus &&
      !subjectStatus.tags?.find((tag) => tag.includes('lang:'))
    ) {
      try {
        const recordLangs = await this.getRecordLang({
          subject,
        })
        await this.moderationService.logEvent({
          event: {
            $type: 'com.atproto.admin.defs#modEventTag',
            add: recordLangs
              ? recordLangs.map((lang) => `lang:${lang}`)
              : ['lang:und'],
            remove: [],
          },
          subject,
          createdBy,
        })
      } catch (err) {
        log.error({ subject, err }, 'Error getting record langs')
      }
    }
  }

  getTextFromRecord(
    uri: string,
    recordValue?: Record<string, unknown>,
  ): string | undefined {
    const atUri = new AtUri(uri)
    let text: string | undefined
    if (
      [ids.AppBskyGraphList, ids.AppBskyFeedGenerator].includes(
        atUri.collection,
      )
    ) {
      text = (recordValue?.description || recordValue?.name) as string
    }

    if (!text && recordValue?.text) {
      text = recordValue.text as string
    }

    return text?.trim()
  }

  async getRecordLang({
    subject,
  }: {
    subject: ModSubject
  }): Promise<string[] | null> {
    const isRecord = subject.isRecord()
    const langs = new Set<string>()

    if (
      subject.isRepo() ||
      (isRecord && subject.uri.endsWith('/app.bsky.actor.profile/self'))
    ) {
      const feed = await this.moderationService.views.fetchAuthorFeed(
        subject.did,
      )
      feed.forEach((item) => {
        const itemLangs = item.post.record['langs'] as string[] | null
        if (itemLangs?.length) {
          // Pick the first fragment of the lang code so that instead of `en-US` and `en-GB` we get `en`
          itemLangs.forEach((lang) => langs.add(lang.split('-')[0]))
        }
      })
    }

    if (isRecord) {
      const recordByUri = await this.moderationService.views.fetchRecords([
        subject,
      ])
      const record = recordByUri.get(subject.uri)
      const recordLang = record?.value.langs as string[] | null
      const recordText = this.getTextFromRecord(subject.uri, record?.value)
      if (recordLang?.length) {
        recordLang
          .map((lang) => lang.split('-')[0])
          .forEach((lang) => langs.add(lang))
      } else if (recordText) {
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
