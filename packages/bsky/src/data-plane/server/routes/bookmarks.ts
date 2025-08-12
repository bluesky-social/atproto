import { PlainMessage, Timestamp } from '@bufbuild/protobuf'
import { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import { Service } from '../../../proto/bsky_connect'
import {
  Bookmark,
  GetBookmarksByActorAndUrisResponse,
} from '../../../proto/bsky_pb'
import { Namespaces } from '../../../stash'
import { Database } from '../db'
import { StashKeyKey } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getBookmarksByActorAndUris(req) {
    const { actorDid, uris } = req

    if (uris.length === 0) {
      return new GetBookmarksByActorAndUrisResponse({
        bookmarks: [],
      })
    }

    const res = await db.db
      .selectFrom('bookmark')
      .where('bookmark.creator', '=', actorDid)
      .where('uri', 'in', uris)
      .selectAll()
      .execute()

    const byUri = keyBy(res, 'uri')
    const bookmarks = uris.map((did): PlainMessage<Bookmark> => {
      const bookmark = byUri.get(did)
      if (!bookmark) {
        return {
          actorDid,
          namespace:
            Namespaces.AppBskyNotificationDefsSubjectActivitySubscription,
          key: '',
          uri: '',
          indexedAt: undefined,
        }
      }

      return {
        actorDid,
        namespace:
          Namespaces.AppBskyNotificationDefsSubjectActivitySubscription,
        key: bookmark.key,
        uri: bookmark.uri,
        indexedAt: Timestamp.fromDate(new Date(bookmark.indexedAt)),
      }
    })

    return {
      bookmarks,
    }
  },

  async getBookmarkUris(req) {
    const { actorDid, cursor, limit } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('bookmark')
      .where('bookmark.creator', '=', actorDid)
      .selectAll()

    const key = new StashKeyKey(ref('bookmark.key'))
    builder = key.paginate(builder, {
      cursor,
      limit,
    })

    const res = await builder.execute()
    return {
      uris: res.map((b) => b.uri),
      cursor: key.packFromResult(res),
    }
  },
})
