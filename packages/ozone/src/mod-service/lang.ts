import { ModSubject } from './subject'
import { ModerationViews } from './views'

export const getRecordLang = async ({
  subject,
  moderationViews,
}: {
  subject: ModSubject
  moderationViews: ModerationViews
}): Promise<string[] | null> => {
  if (!subject.isRecord()) {
    return null
  }
  const recordByUri = await moderationViews.fetchRecords([subject])
  const record = recordByUri.get(subject.uri)
  return (record?.value.langs as string[]) || null
}
