import { langLogger as log } from '../logger'
import { ModerationService } from '../mod-service'
import { ModSubject } from '../mod-service/subject'
import { ModerationSubjectStatusRow } from '../mod-service/types'
import { ContentTagger } from './content-tagger'
import { EmbedTagger } from './embed-tagger'
import { LanguageTagger } from './language-tagger'

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

  // Allow the caller to seed the initial tags
  async evaluateForSubject(initialTags?: Iterable<string>) {
    try {
      const tags = new Set(initialTags)

      await Promise.all(
        this.taggers.map(async (tagger) => {
          try {
            const newTags = await tagger.getTags()
            for (const newTag of newTags) {
              tags.add(newTag)
            }
          } catch (e) {
            // Don't let one tagger error stop the rest from running
            log.error(
              { subject: this.subject, err: e },
              'Error applying tagger',
            )
          }
        }),
      )

      // Ensure that before inserting new tags, we discard any tag that may
      // have been evaluated to be added but is already present in the subject
      if (this.subjectStatus?.tags?.length) {
        for (const tag of this.subjectStatus.tags) {
          tags.delete(tag)
        }
      }

      if (tags.size) {
        await this.moderationService.logEvent({
          event: {
            $type: 'tools.ozone.moderation.defs#modEventTag',
            add: [...tags],
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
