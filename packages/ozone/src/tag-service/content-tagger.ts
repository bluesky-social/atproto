import { ModerationService } from '../mod-service'
import { ModSubject } from '../mod-service/subject'
import { ModerationSubjectStatusRow } from '../mod-service/types'

export abstract class ContentTagger {
  constructor(
    protected subject: ModSubject,
    protected subjectStatus: ModerationSubjectStatusRow | null,
    protected moderationService: ModerationService,
  ) {}

  abstract isApplicable(): boolean
  abstract getTags(): Promise<string[]>
}
