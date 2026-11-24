import type { ServiceImpl } from '@connectrpc/connect'
import { sql } from 'kysely'
import { DAY, keyBy } from '@atproto/common'
import type { Service } from '../../../proto/bsky_connect.js'
import { PostVersionCounts } from '../../../proto/bsky_pb.js'
import type { Database } from '../db/index.js'
import { countAll } from '../db/util.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getInteractionCounts(req) {
    const uris = req.refs.map((ref) => ref.uri)
    if (uris.length === 0) {
      return { likes: [], replies: [], reposts: [], quotes: [] }
    }
    const res = await db.db
      .selectFrom('post_agg')
      .where('uri', 'in', uris)
      .selectAll()
      .execute()
    const byUri = keyBy(res, 'uri')
    return {
      likes: uris.map((uri) => byUri.get(uri)?.likeCount ?? 0),
      replies: uris.map((uri) => byUri.get(uri)?.replyCount ?? 0),
      reposts: uris.map((uri) => byUri.get(uri)?.repostCount ?? 0),
      quotes: uris.map((uri) => byUri.get(uri)?.quoteCount ?? 0),
      bookmarks: uris.map((uri) => byUri.get(uri)?.bookmarkCount ?? 0),
    }
  },
  async getPostVersionCounts(req) {
    if (req.refs.length === 0) return { counts: [] }

    const uris = req.refs.map((ref) => ref.uri)
    const cids = req.refs.map((ref) => ref.cid)
    const { rows } = await sql<{
      ordinal: string
      likes: number
      reposts: number
      replies: number
      quotes: number
      bookmarks: number
    }>`
      select
        refs.ordinal,
        (
          select count(*)::int from "like"
          where "like".subject = refs.uri and "like"."subjectCid" = refs.cid
        ) as likes,
        (
          select count(*)::int from repost
          where repost.subject = refs.uri and repost."subjectCid" = refs.cid
        ) as reposts,
        (
          select count(*)::int from post
          where post."replyParent" = refs.uri and post."replyParentCid" = refs.cid
        ) as replies,
        (
          select count(*)::int from quote
          where quote.subject = refs.uri and quote."subjectCid" = refs.cid
        ) as quotes,
        (
          select count(*)::int from bookmark
          where bookmark."subjectUri" = refs.uri and bookmark."subjectCid" = refs.cid
        ) as bookmarks
      from unnest(${uris}::varchar[], ${cids}::varchar[]) with ordinality
        as refs(uri, cid, ordinal)
      order by refs.ordinal
    `.execute(db.db)

    return {
      counts: rows.map(
        (row, index) =>
          new PostVersionCounts({
            ref: req.refs[index],
            likes: row.likes,
            reposts: row.reposts,
            replies: row.replies,
            quotes: row.quotes,
            bookmarks: row.bookmarks,
          }),
      ),
    }
  },
  async getCountsForUsers(req) {
    if (req.dids.length === 0) {
      return {}
    }
    const { ref } = db.db.dynamic
    const res = await db.db
      .selectFrom('profile_agg')
      .where('did', 'in', req.dids)
      .selectAll('profile_agg')
      .select([
        db.db
          .selectFrom('feed_generator')
          .whereRef('creator', '=', ref('profile_agg.did'))
          .select(countAll.as('val'))
          .as('feedGensCount'),
        db.db
          .selectFrom('list')
          .whereRef('creator', '=', ref('profile_agg.did'))
          .select(countAll.as('val'))
          .as('listsCount'),
        db.db
          .selectFrom('starter_pack')
          .whereRef('creator', '=', ref('profile_agg.did'))
          .select(countAll.as('val'))
          .as('starterPacksCount'),
        db.db
          .selectFrom('draft')
          .whereRef('creator', '=', ref('profile_agg.did'))
          .select(countAll.as('val'))
          .as('draftsCount'),
      ])
      .execute()
    const byDid = keyBy(res, 'did')
    return {
      followers: req.dids.map((uri) => byDid.get(uri)?.followersCount ?? 0),
      following: req.dids.map((uri) => byDid.get(uri)?.followsCount ?? 0),
      posts: req.dids.map((uri) => byDid.get(uri)?.postsCount ?? 0),
      lists: req.dids.map((uri) => byDid.get(uri)?.listsCount ?? 0),
      feeds: req.dids.map((uri) => byDid.get(uri)?.feedGensCount ?? 0),
      starterPacks: req.dids.map(
        (uri) => byDid.get(uri)?.starterPacksCount ?? 0,
      ),
      drafts: req.dids.map((uri) => byDid.get(uri)?.draftsCount ?? 0),
    }
  },
  async getStarterPackCounts(req) {
    const weekAgo = new Date(Date.now() - 7 * DAY)
    const uris = req.refs.map((ref) => ref.uri)
    if (uris.length === 0) {
      return { joinedAllTime: [], joinedWeek: [] }
    }
    const countsAllTime = await db.db
      .selectFrom('profile')
      .where('joinedViaStarterPackUri', 'in', uris)
      .select(['joinedViaStarterPackUri as uri', countAll.as('count')])
      .groupBy('joinedViaStarterPackUri')
      .execute()
    const countsWeek = await db.db
      .selectFrom('profile')
      .where('joinedViaStarterPackUri', 'in', uris)
      .where('createdAt', '>', weekAgo.toISOString())
      .select(['joinedViaStarterPackUri as uri', countAll.as('count')])
      .groupBy('joinedViaStarterPackUri')
      .execute()
    const countsWeekByUri = countsWeek.reduce((cur, item) => {
      if (!item.uri) return cur
      return cur.set(item.uri, item.count)
    }, new Map<string, number>())
    const countsAllTimeByUri = countsAllTime.reduce((cur, item) => {
      if (!item.uri) return cur
      return cur.set(item.uri, item.count)
    }, new Map<string, number>())
    return {
      joinedWeek: uris.map((uri) => countsWeekByUri.get(uri) ?? 0),
      joinedAllTime: uris.map((uri) => countsAllTimeByUri.get(uri) ?? 0),
    }
  },
  async getListCounts(req) {
    const uris = req.refs.map((ref) => ref.uri)
    if (uris.length === 0) {
      return { listItems: [] }
    }
    const countsListItems = await db.db
      .selectFrom('list_item')
      .where('listUri', 'in', uris)
      .select(['listUri as uri', countAll.as('count')])
      .groupBy('listUri')
      .execute()
    const countsByUri = keyBy(countsListItems, 'uri')
    return {
      listItems: uris.map((uri) => countsByUri.get(uri)?.count ?? 0),
    }
  },
})
