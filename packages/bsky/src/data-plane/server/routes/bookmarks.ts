import { create } from '@bufbuild/protobuf'
import { timestampFromDate } from '@bufbuild/protobuf/wkt'
import { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import {
  Bookmark,
  BookmarkSchema,
  GetBookmarksByActorAndSubjectsResponse,
  GetBookmarksByActorAndSubjectsResponseSchema,
  Service,
  StashRefSchema,
} from '../../../proto/bsky_pb.js'
import { Namespaces } from '../../../stash.js'
import { Database } from '../db/index.js'
import { StashKeyKey } from '../db/pagination.js'

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
      bookmarks: res.map((b) => ({
        key: b.key,
        subject: b.subjectUri,
      })),
      cursor: key.packFromResult(res),
    }
  },

  async getBookmarksByActorAndSubjects(
    req,
  ): Promise<GetBookmarksByActorAndSubjectsResponse> {
    const { actorDid, uris } = req

    if (uris.length === 0) {
      return create(GetBookmarksByActorAndSubjectsResponseSchema, {
        bookmarks: [],
      })
    }

    const res = await db.db
      .selectFrom('bookmark')
      .where('bookmark.creator', '=', actorDid)
      .where('bookmark.subjectUri', 'in', uris)
      .selectAll()
      .execute()

    const byUri = keyBy(res, 'subjectUri')
    const bookmarks = uris.map((did): Bookmark => {
      const bookmark = byUri.get(did)
      if (!bookmark) {
        return create(BookmarkSchema, {
          ref: undefined,
          subjectUri: '',
          subjectCid: '',
          indexedAt: undefined,
        })
      }

      return create(BookmarkSchema, {
        ref: create(StashRefSchema, {
          actorDid,
          namespace: Namespaces.AppBskyBookmarkDefsBookmark.$type,
          key: bookmark.key,
        }),
        subjectUri: bookmark.subjectUri,
        subjectCid: bookmark.subjectCid,
        indexedAt: timestampFromDate(new Date(bookmark.indexedAt)),
      })
    })

    return create(GetBookmarksByActorAndSubjectsResponseSchema, {
      bookmarks,
    })
  },
})
