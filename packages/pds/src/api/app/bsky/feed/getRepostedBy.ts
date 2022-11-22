import { sql } from 'kysely'
import { Server } from '../../../../lexicon'
import * as GetRepostedBy from '../../../../lexicon/types/app/bsky/feed/getRepostedBy'
import * as locals from '../../../../locals'
import { Keyset, paginate } from '../../../../db/util'
import { getDeclarationSimple } from '../util'

export default function (server: Server) {
  server.app.bsky.feed.getRepostedBy(
    async (params: GetRepostedBy.QueryParams, _input, _req, res) => {
      const { uri, limit, before, cid } = params
      const { db } = locals.get(res)

      let builder = db.db
        .selectFrom('repost')
        .where('repost.subject', '=', uri)
        .innerJoin('did_handle', 'did_handle.did', 'repost.creator')
        .leftJoin('profile', 'profile.creator', 'did_handle.did')
        .select([
          'did_handle.did as did',
          'did_handle.declarationCid as declarationCid',
          'did_handle.actorType as actorType',
          'did_handle.handle as handle',
          'profile.displayName as displayName',
          'repost.uri as uri',
          'repost.createdAt as createdAt',
          'repost.indexedAt as indexedAt',
        ])

      if (cid) {
        builder = builder.where('repost.subjectCid', '=', cid)
      }

      const keyset = new RepostsKeyset()
      builder = paginate(builder, {
        limit,
        before,
        keyset,
      })

      const repostedByRes = await builder.execute()
      const repostedBy = repostedByRes.map((row) => ({
        did: row.did,
        declaration: getDeclarationSimple(row),
        handle: row.handle,
        displayName: row.displayName || undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          uri,
          cid,
          repostedBy,
          cursor: keyset.packFromResult(repostedByRes),
        },
      }
    },
  )
}

type RepostRow = { createdAt: string; uri: string }
class RepostsKeyset extends Keyset<RepostRow> {
  primary = sql`repost.createdAt`
  secondary = sql`repost.uri`
  cursorFromResult(result: RepostRow) {
    return { primary: result.createdAt, secondary: result.uri }
  }
}
