import { ModerationService } from '../mod-service'
import { ModSubject } from '../mod-service/subject'
import { ModerationSubjectStatusRow } from '../mod-service/types'

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
