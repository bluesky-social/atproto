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
  async getActorBookmarks(req) {
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
      bookmarks: res.map(
        (b): PlainMessage<Bookmark> => ({
          actorDid: b.creator,
          indexedAt: Timestamp.fromDate(new Date(b.indexedAt)),
          key: b.key,
          namespace: Namespaces.AppBskyBookmarkDefsBookmark,
          subject: {
            cid: b.subjectCid,
            uri: b.subjectUri,
          },
        }),
      ),
      cursor: key.packFromResult(res),
    }
  },

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
      .where('subjectUri', 'in', uris)
      .selectAll()
      .execute()

    const byUri = keyBy(res, 'subjectUri')
    const bookmarks = uris.map((did): PlainMessage<Bookmark> => {
      const bookmark = byUri.get(did)
      if (!bookmark) {
        return {
          actorDid: '',
          namespace: '',
          key: '',
          subject: undefined,
          indexedAt: undefined,
        }
      }

      return {
        actorDid,
        namespace:
          Namespaces.AppBskyNotificationDefsSubjectActivitySubscription,
        key: bookmark.key,
        subject: {
          uri: bookmark.subjectUri,
          cid: bookmark.subjectCid,
        },
        indexedAt: Timestamp.fromDate(new Date(bookmark.indexedAt)),
      }
    })

    return {
      bookmarks,
    }
  },
})
