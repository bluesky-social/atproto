import { langLogger as log } from '../logger.js'
import type { ModerationService } from '../mod-service/index.js'
import type { ModSubject } from '../mod-service/subject.js'
import type { ModerationSubjectStatusRow } from '../mod-service/types.js'
import type { ContentTagger } from './content-tagger.js'
import { EmbedTagger } from './embed-tagger.js'
import { LanguageTagger } from './language-tagger.js'

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

      // Collect tagger results and add them in declared tagger order, so that
      // the resulting tag order does not depend on which tagger resolves first
      const taggerResults = await Promise.all(
        this.taggers.map(async (tagger) => {
          try {
            return await tagger.getTags()
          } catch (e) {
            // Don't let one tagger error stop the rest from running
            log.error(
              { subject: this.subject, err: e },
              'Error applying tagger',
            )
            return []
          }
        }),
      )
      for (const newTags of taggerResults) {
        for (const newTag of newTags) {
          tags.add(newTag)
        }
      }

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
