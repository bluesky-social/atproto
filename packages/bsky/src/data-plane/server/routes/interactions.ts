import { DAY, keyBy } from '@atproto/common'
import { jsonStringToLex } from '@atproto/lexicon'
import { ServiceImpl } from '@connectrpc/connect'
import {
  isRecord as isStarterPackRecord,
  Record as StarterPackRecord,
} from '../../../lexicon/types/app/bsky/graph/starterpack'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { countAll } from '../db/util'

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
    return {
      likes: uris.map((uri) => byUri[uri]?.likeCount ?? 0),
      replies: uris.map((uri) => byUri[uri]?.replyCount ?? 0),
      reposts: uris.map((uri) => byUri[uri]?.repostCount ?? 0),
    }
  },
  async getCountsForUsers(req) {
    if (req.dids.length === 0) {
      return { followers: [], following: [], posts: [] }
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
    }
  },
  async getCountsForStarterPacks(req) {
    const weekAgo = new Date(Date.now() - 7 * DAY)
    const uris = req.refs.map((ref) => ref.uri)
    if (uris.length === 0) {
      return { feeds: [], joinedAllTime: [], joinedWeek: [], listItems: [] }
    }
    const records = await db.db
      .selectFrom('record')
      .where('uri', 'in', uris)
      .selectAll()
      .execute()
    const recordsByUri = records.reduce((cur, r) => {
      const record = jsonStringToLex(r.json)
      if (!isStarterPackRecord(record)) return cur
      return cur.set(r.uri, record)
    }, new Map<string, StarterPackRecord>())
    const listUris = [...recordsByUri.values()].flatMap((r) => {
      return r.list ?? []
    })
    const countsListItems = listUris.length
      ? await db.db
          .selectFrom('list_item')
          .where('uri', 'in', listUris)
          .select(['listUri as uri', countAll.as('count')])
          .groupBy('listUri')
          .execute()
      : []
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
    const countsListItemsByListUri = countsListItems.reduce((cur, item) => {
      return cur.set(item.uri, item.count)
    }, new Map<string, number>())
    const countsWeekByUri = countsWeek.reduce((cur, item) => {
      if (!item.uri) return cur
      return cur.set(item.uri, item.count)
    }, new Map<string, number>())
    const countsAllTimeByUri = countsAllTime.reduce((cur, item) => {
      if (!item.uri) return cur
      return cur.set(item.uri, item.count)
    }, new Map<string, number>())
    return {
      feeds: uris.map((uri) => recordsByUri.get(uri)?.feeds?.length ?? 0),
      listItems: uris.map((uri) => {
        const listUri = recordsByUri.get(uri)?.list
        if (!listUri) return 0
        return countsListItemsByListUri.get(listUri) ?? 0
      }),
      joinedWeek: uris.map((uri) => countsWeekByUri.get(uri) ?? 0),
      joinedAllTime: uris.map((uri) => countsAllTimeByUri.get(uri) ?? 0),
    }
  },
})
