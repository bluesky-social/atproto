import lande from 'lande'

import { ModerationService } from '.'
import { ModSubject } from './subject'
import { ModerationSubjectStatusRow } from './types'
import { langLogger as log } from '../logger'
import { code3ToCode2 } from './lang-data'
import {
  AppBskyActorProfile,
  AppBskyFeedGenerator,
  AppBskyFeedPost,
  AppBskyGraphList,
} from '@atproto/api'

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
            $type: 'tools.ozone.moderation.defs#modEventTag',
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

  getTextFromRecord(recordValue?: Record<string, unknown>): string | undefined {
    let text: string | undefined

    if (AppBskyGraphList.isRecord(recordValue)) {
      text = recordValue.description || recordValue.name
    } else if (
      AppBskyFeedGenerator.isRecord(recordValue) ||
      AppBskyActorProfile.isRecord(recordValue)
    ) {
      text = recordValue.description || recordValue.displayName
    } else if (AppBskyFeedPost.isRecord(recordValue)) {
      text = recordValue.text
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
      const recordText = this.getTextFromRecord(record?.value)
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
