import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
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
      { name: 'whats_hot_like_threshold', value: '2' },
      { name: 'whats_hot_interval', value: '1day' },
    ])
    .execute()

  // define view query for whats-hot feed
  // tldr: scored by like count depreciated over time.

  // From: https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d
  // Score = (P-1) / (T+2)^G
  // where,
  // P = points of an item (and -1 is to negate submitters vote)
  // T = time since submission (in hours)
  // G = Gravity, defaults to 1.8 in news.arc

  const likeCount = ref('post_agg.likeCount')
  const indexedAt = ref('post.indexedAt')
  const computeScore = sql<number>`round(1000000 * (${likeCount} / ((EXTRACT(epoch FROM AGE(now(), ${indexedAt}::timestamp)) / 3600 + 2) ^ 1.8)))`

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

  await db.schema
    .createView('algo_whats_hot_view')
    .materialized()
    .as(viewQb)
    .execute()

  // unique index required for pg to refresh view w/ "concurrently" param.
  await db.schema
    .createIndex('algo_whats_hot_view_uri_idx')
    .on('algo_whats_hot_view')
    .column('uri')
    .unique()
    .execute()
  await db.schema
    .createIndex('algo_whats_hot_view_cursor_idx')
    .on('algo_whats_hot_view')
    .columns(['score', 'cid'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropView('algo_whats_hot_view').materialized().execute()
  await db.schema.dropTable('view_param').execute()
}
