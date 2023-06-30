import { sql } from 'kysely'
import Database from '../../db'

export const getDescendentsQb = (
  db: Database,
  opts: {
    uri: string
    depth: number
  },
) => {
  const { uri, depth } = opts
  const query = db.db.withRecursive('descendent(uri, depth)', (cte) => {
    return cte
      .selectFrom('post')
      .select(['post.uri as uri', sql<number>`1`.as('depth')])
      .where(sql`1`, '<=', depth)
      .where('replyParent', '=', uri)
      .unionAll(
        cte
          .selectFrom('post')
          .innerJoin('descendent', 'descendent.uri', 'post.replyParent')
          .where('descendent.depth', '<', depth)
          .select([
            'post.uri as uri',
            sql<number>`descendent.depth + 1`.as('depth'),
          ]),
      )
  })
  return query
}

export const getAncestorsAndSelfQb = (
  db: Database,
  opts: {
    uri: string
    parentHeight: number
  },
) => {
  const { uri, parentHeight } = opts
  const query = db.db.withRecursive(
    'ancestor(uri, ancestorUri, height)',
    (cte) => {
      return cte
        .selectFrom('post')
        .select([
          'post.uri as uri',
          'post.replyParent as ancestorUri',
          sql<number>`0`.as('height'),
        ])
        .where('uri', '=', uri)
        .unionAll(
          cte
            .selectFrom('post')
            .innerJoin('ancestor', 'ancestor.ancestorUri', 'post.uri')
            .where('ancestor.height', '<', parentHeight)
            .select([
              'post.uri as uri',
              'post.replyParent as ancestorUri',
              sql<number>`ancestor.height + 1`.as('height'),
            ]),
        )
    },
  )
  return query
}
