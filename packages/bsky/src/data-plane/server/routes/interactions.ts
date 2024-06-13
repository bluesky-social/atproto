import { DAY, keyBy } from '@atproto/common'
import { ServiceImpl } from '@connectrpc/connect'
import { ids } from '../../../lexicon/lexicons'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { countAll } from '../db/util'
import { urisByCollection } from '../../../hydration/util'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getInteractionCounts(req) {
    const uris = req.refs.map((ref) => ref.uri)
    if (uris.length === 0) {
      return { likes: [], replies: [], reposts: [] }
    }
    const res = await db.db
      .selectFrom('post_agg')
      .where('uri', 'in', uris)
      .selectAll()
      .execute()
    const byUri = keyBy(res, 'uri')
    const listUris = urisByCollection(uris).get(ids.AppBskyGraphList) ?? []
    const countsListItems = listUris.length
      ? await db.db
          .selectFrom('list_item')
          .where('listUri', 'in', listUris)
          .select(['listUri as uri', countAll.as('count')])
          .groupBy('listUri')
          .execute()
      : []
    const listItemCountsByUri = keyBy(countsListItems, 'uri')
    return {
      likes: uris.map((uri) => byUri[uri]?.likeCount ?? 0),
      replies: uris.map((uri) => byUri[uri]?.replyCount ?? 0),
      reposts: uris.map((uri) => byUri[uri]?.repostCount ?? 0),
      listItems: uris.map((uri) => listItemCountsByUri[uri]?.count ?? 0),
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
      ])
      .execute()
    const byDid = keyBy(res, 'did')
    return {
      followers: req.dids.map((uri) => byDid[uri]?.followersCount ?? 0),
      following: req.dids.map((uri) => byDid[uri]?.followsCount ?? 0),
      posts: req.dids.map((uri) => byDid[uri]?.postsCount ?? 0),
      lists: req.dids.map((uri) => byDid[uri]?.listsCount ?? 0),
      feeds: req.dids.map((uri) => byDid[uri]?.feedGensCount ?? 0),
      starterPacks: req.dids.map((_uri) => 0), // @TODO
    }
  },
  async getCountsForStarterPacks(req) {
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
})
