import { Kysely, sql } from 'kysely'

export async function up(
  db: Kysely<{ post: Post; post_hierarchy: PostHierarchy }>,
): Promise<void> {
  await db.schema
    .createTable('post_hierarchy')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('ancestorUri', 'varchar', (col) => col.notNull())
    .addColumn('depth', 'integer', (col) => col.notNull())
    .addPrimaryKeyConstraint('post_hierarchy_pkey', ['uri', 'ancestorUri'])
    .execute()

  // Supports fetching all children for a post
  await db.schema
    .createIndex('post_hierarchy_ancestoruri_idx')
    .on('post_hierarchy')
    .column('ancestorUri')
    .execute()

  const postHierarchyQb = db
    .withRecursive('hierarchy(uri, ancestorUri, depth)', (cte) => {
      return cte
        .selectFrom('post')
        .select([
          'post.uri as uri',
          'post.uri as ancestorUri',
          sql<number>`0`.as('depth'),
        ])
        .unionAll(
          cte
            .selectFrom('post')
            .innerJoin('hierarchy', 'hierarchy.ancestorUri', 'post.uri')
            .where('post.replyParent', 'is not', null)
            .select([
              'hierarchy.uri as uri',
              sql<string>`post."replyParent"`.as('ancestorUri'),
              sql<number>`hierarchy.depth + 1`.as('depth'),
            ]),
        )
    })
    .selectFrom('hierarchy')

  await db
    .insertInto('post_hierarchy')
    .columns(['uri', 'ancestorUri', 'depth'])
    .expression(postHierarchyQb.select(['uri', 'ancestorUri', 'depth']))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('post_hierarchy_ancestoruri_idx').execute()
  await db.schema.dropTable('post_hierarchy').execute()
}

type Post = {
  uri: string
  replyParent: string | null
}

type PostHierarchy = {
  uri: string
  ancestorUri: string
  depth: number
}
