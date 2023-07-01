import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<any>, dialect: Dialect): Promise<void> {
  if (dialect !== 'pg') return

  await db
    .insertInto('view_param')
    .values([{ name: 'recent_feed_items_limit', value: '1day' }])
    .execute()

  const viewQb = db
    .selectFrom('feed_item')
    .where(
      'sortAt',
      '>',
      db
        .selectFrom('view_param')
        .where('name', '=', 'recent_feed_items_limit')
        .select(
          sql`to_char(now() - value::interval, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`.as(
            'val',
          ),
        ),
    )
    .selectAll()

  const query = db.schema
    .createView('recent_feed_items_view')
    .materialized()
    .as(viewQb)

  console.log(query.compile().sql)

  await db.schema
    .createView('recent_feed_items_view')
    .materialized()
    .as(viewQb)
    .execute()

  // unique index required for pg to refresh view w/ "concurrently" param.
  await db.schema
    .createIndex('recent_feed_items_view_uri_idx')
    .on('recent_feed_items_view')
    .column('uri')
    .unique()
    .execute()
  await db.schema
    .createIndex('recent_feed_items_view_cursor_idx')
    .on('recent_feed_items_view')
    .columns(['sortAt', 'cid'])
    .execute()
  await db.schema
    .createIndex('recent_feed_items_originator_idx')
    .on('recent_feed_items_view')
    .column('originatorDid')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropView('recent_feed_items_view').materialized().execute()
}
