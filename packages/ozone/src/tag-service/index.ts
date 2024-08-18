import { ModerationService } from '../mod-service'
import { ModSubject } from '../mod-service/subject'
import { langLogger as log } from '../logger'
import { ContentTagger } from './content-tagger'
import { LanguageTagger } from './language-tagger'
import { EmbedTagger } from './embed-tagger'
import { ModerationSubjectStatusRow } from '../mod-service/types'

export class TagService {
  private taggers: ContentTagger[]

  constructor(
    private subject: ModSubject,
    protected subjectStatus: ModerationSubjectStatusRow | null,
    private taggerDid: string,
    private moderationService: ModerationService,
  ) {
    this.taggers = [
      new LanguageTagger(subject, subjectStatus, moderationService),
      new EmbedTagger(subject, subjectStatus, moderationService),
      // Add more taggers as needed
    ]
  }

  async evaluateForSubject() {
    try {
      const tags: string[] = []

      await Promise.all(
        this.taggers.map(async (tagger) => {
          try {
            const newTags = await tagger.getTags()
            if (newTags.length) tags.push(...newTags)
          } catch (e) {
            // Don't let one tagger error stop the rest from running
            log.error(
              { subject: this.subject, err: e },
              'Error applying tagger',
            )
          }
        }),
      )

      if (tags.length > 0) {
        await this.moderationService.logEvent({
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: tags,
            remove: [],
          },
          subject: this.subject,
          createdBy: this.taggerDid,
        })
      }
    } catch (err) {
      log.error({ subject: this.subject, err }, 'Error tagging subject')
    }
  }
}
