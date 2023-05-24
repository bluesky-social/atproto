import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<any>, dialect: Dialect): Promise<void> {
  if (dialect !== 'pg') return

  const { ref } = db.dynamic

  // materialized views are difficult to change,
  // so we parameterize them at runtime with contents of this table.
  await db.schema
    .createTable('view_param')
    .addColumn('name', 'varchar', (col) => col.primaryKey())
    .addColumn('value', 'varchar')
    .execute()

  await db
    .insertInto('view_param')
    .values([
      { name: 'whats_hot_like_threshold', value: '10' },
      { name: 'whats_hot_interval', value: '1day' },
    ])
    .execute()

  // define view query for whats-hot feed
  const likeCount = ref('post_agg.likeCount')
  const indexedAt = ref('post.indexedAt')
  const computeScore = sql<number>`${likeCount} / ((EXTRACT(epoch FROM AGE(now(), ${indexedAt}::timestamp)) / 3600 + 2) ^ 1.8)`
  const viewQb = db
    .selectFrom('post')
    .innerJoin('post_agg', 'post_agg.uri', 'post.uri')
    .where(
      'post.indexedAt',
      '>',
      db
        .selectFrom('view_param')
        .where('name', '=', 'whats_hot_interval')
        .select(
          sql`to_char(now() - value::interval, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`.as(
            'val',
          ),
        ),
    )
    .where('post.replyParent', 'is', null)
    .where(
      'post_agg.likeCount',
      '>',
      db // helps cull result set that needs to be sorted
        .selectFrom('view_param')
        .where('name', '=', 'whats_hot_like_threshold')
        .select(sql`value::integer`.as('val')),
    )
    .select(['post.uri as uri', 'post.cid as cid', computeScore.as('score')])

  await sql`create materialized view algo_whats_hot_view as (${viewQb}) with no data`.execute(
    db,
  )
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect !== 'pg') return
  await db.schema.dropView('algo_whats_hot_view').materialized().execute()
  await db.schema.dropTable('view_param').execute()
}
