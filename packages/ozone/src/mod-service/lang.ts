import { ModerationService } from '.'
import { ModSubject } from './subject'
import { ModerationSubjectStatusRow } from './types'

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
              : ['lang:unknown'],
            remove: [],
          },
          subject,
          createdBy,
        })
      } catch (err) {
        console.error('Error getting record langs', err)
      }
    }
  }

  async getRecordLang({
    subject,
  }: {
    subject: ModSubject
  }): Promise<string[] | null> {
    const isRecord = subject.isRecord()
    if (
      subject.isRepo() ||
      (isRecord && subject.uri.endsWith('/app.bsky.actor.profile/self'))
    ) {
      const feed = await this.moderationService.views.fetchAuthorFeed(
        subject.did,
      )
      const langs = new Set<string>()
      feed.forEach((item) => {
        const itemLangs = item.post.record['langs'] as string[] | null
        if (itemLangs?.length) {
          itemLangs.forEach((lang) => langs.add(lang))
        }
      })
      return langs.size > 0 ? Array.from(langs) : null
    }

    if (isRecord) {
      const recordByUri = await this.moderationService.views.fetchRecords([
        subject,
      ])
      const record = recordByUri.get(subject.uri)
      return (record?.value.langs as string[]) || null
    }

    return null
  }
}
