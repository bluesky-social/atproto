import { ModerationService } from '../mod-service/index.js'
import { ModSubject } from '../mod-service/subject.js'
import { ModerationSubjectStatusRow } from '../mod-service/types.js'

export abstract class ContentTagger {
  constructor(
    protected subject: ModSubject,
    protected subjectStatus: ModerationSubjectStatusRow | null,
    protected moderationService: ModerationService,
  ) {}

  protected abstract tagPrefix: string

  protected abstract isApplicable(): boolean
  protected abstract buildTags(): Promise<string[]>

  async getTags(): Promise<string[]> {
    if (!this.isApplicable()) {
      return []
    }

    return this.buildTags()
  }

  protected tagAlreadyExists(): boolean {
    return Boolean(
      this.subjectStatus?.tags?.some((tag) => tag.startsWith(this.tagPrefix)),
    )
  }
}
