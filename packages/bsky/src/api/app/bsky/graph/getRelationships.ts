import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { Relationship } from '../../../../lexicon/types/app/bsky/graph/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getRelationships({
    handler: async ({ params }) => {
      const { actor, others = [] } = params
      if (others.length < 1) {
        return {
          encoding: 'application/json',
          body: {
            actor,
            relationships: [],
          },
        }
      }
      const db = ctx.db.getPrimary()
      const { ref } = db.db.dynamic
      const res = await db.db
        .selectFrom('actor')
        .select([
          'actor.did',
          db.db
            .selectFrom('follow')
            .where('creator', '=', actor)
            .whereRef('subjectDid', '=', ref('actor.did'))
            .select('uri')
            .as('following'),
          db.db
            .selectFrom('follow')
            .whereRef('creator', '=', ref('actor.did'))
            .where('subjectDid', '=', actor)
            .select('uri')
            .as('followedBy'),
        ])
        .where('actor.did', 'in', others)
        .execute()

      const relationshipsMap = res.reduce((acc, cur) => {
        return acc.set(cur.did, {
          did: cur.did,
          following: cur.following ?? undefined,
          followedBy: cur.followedBy ?? undefined,
        })
      }, new Map<string, Relationship>())

      const relationships = others.map((did) => {
        const relationship = relationshipsMap.get(did)
        return relationship
          ? {
              $type: 'app.bsky.graph.defs#relationship',
              ...relationship,
            }
          : {
              $type: 'app.bsky.graph.defs#notFoundActor',
              actor: did,
              notFound: true,
            }
      })

      return {
        encoding: 'application/json',
        body: {
          actor,
          relationships,
        },
      }
    },
  })
}
