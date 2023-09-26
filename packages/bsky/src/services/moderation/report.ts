import { PrimaryDatabase } from '../../db'
import { ModerationAction } from '../../db/tables/moderation'
import { REPORT } from '../../lexicon/types/com/atproto/admin/defs'
import { SubjectInfo } from './types'

export const getReportIdsToBeResolved = async (
  db: PrimaryDatabase,
  subjectInfo: SubjectInfo,
) => {
  const { ref } = db.db.dynamic
  const unResolvedReportIdsQuery = db.db
    .selectFrom('moderation_action')
    .select('id')
    .where('action', '=', REPORT)
    .where((qb) => {
      Object.entries(subjectInfo).forEach(([key, value]) => {
        // TODO: Feels dirty to cast here, once we upgrade kysely, we can use the object filter directly without having to build the where query
        qb = qb.where(key as keyof ModerationAction, '=', value)
      })
      return qb
    })
    // Would this query be slow?
    .whereNotExists((qb) =>
      qb
        .selectFrom('moderation_report_resolution')
        .select('reportId')
        .whereRef('reportId', '=', ref('moderation_action.id')),
    )
    .execute()

  return (await unResolvedReportIdsQuery).map(({ id }) => id)
}
