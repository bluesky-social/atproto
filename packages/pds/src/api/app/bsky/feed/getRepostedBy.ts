import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import { getDeclarationSimple } from '../util'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getRepostedBy({
    auth: ctx.accessVerifier,
    handler: async ({ params }) => {
      const { uri, limit, before, cid } = params
      const { ref } = ctx.db.db.dynamic

      let builder = ctx.db.db
        .selectFrom('repost')
        .where('repost.subject', '=', uri)
        .innerJoin('did_handle as creator', 'creator.did', 'repost.creator')
        .leftJoin('profile', 'profile.creator', 'repost.creator')
        .innerJoin(
          'repo_root as creator_repo',
          'creator_repo.did',
          'repost.creator',
        )
        .where(notSoftDeletedClause(ref('creator_repo')))
        .select([
          'creator.did as did',
          'creator.declarationCid as declarationCid',
          'creator.actorType as actorType',
          'creator.handle as handle',
          'profile.displayName as displayName',
          'profile.avatarCid as avatarCid',
          'repost.cid as cid',
          'repost.createdAt as createdAt',
          'repost.indexedAt as indexedAt',
        ])

      if (cid) {
        builder = builder.where('repost.subjectCid', '=', cid)
      }

      const keyset = new TimeCidKeyset(
        ref('repost.createdAt'),
        ref('repost.cid'),
      )
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
        avatar: row.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
          : undefined,
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
  })
}
