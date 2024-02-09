import { ModSubject } from './subject'
import { ModerationViews } from './views'

export const getRecordLang = async ({
  subject,
  moderationViews,
}: {
  subject: ModSubject
  moderationViews: ModerationViews
}): Promise<string[] | null> => {
  // If subject is a repo, fetch the author feed and get all langs from posts
  if (subject.isRepo()) {
    const feed = await moderationViews.fetchAuthorFeed(subject.did)
    const langs = new Set<string>()
    feed.forEach((item) => {
      const itemLangs = item.post.record['langs'] as string[] | null
      if (itemLangs?.length) {
        itemLangs.forEach((lang) => langs.add(lang))
      }
    })
    return langs.size > 0 ? Array.from(langs) : null
  }

  if (subject.isRecord()) {
    const recordByUri = await moderationViews.fetchRecords([subject])
    const record = recordByUri.get(subject.uri)
    return (record?.value.langs as string[]) || null
  }

  return null
}
