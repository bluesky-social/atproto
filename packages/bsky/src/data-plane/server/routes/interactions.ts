import { ServiceImpl } from '@connectrpc/connect'
import { DAY, keyBy } from '@atproto/common'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { countAll } from '../db/util'

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
