import AppContext from '../../../../context'
import Database from '../../../../db'
import { Server } from '../../../../lexicon'
import * as Method from '../../../../lexicon/types/app/bsky/actor/search'
import { getDeclarationSimple } from '../util'
import {
  cleanTerm,
  getUserSearchQueryPg,
  getUserSearchQuerySqlite,
} from '../util/search'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.searchTypeahead({
    auth: ctx.accessVerifier,
    handler: async ({ params }) => {
      let { term, limit } = params

      term = cleanTerm(term || '')
      limit = Math.min(limit ?? 25, 100)

      if (!term) {
        return {
          encoding: 'application/json',
          body: {
            users: [],
          },
        }
      }

      const results =
        ctx.db.dialect === 'pg'
          ? await getResultsPg(ctx.db, { term, limit })
          : await getResultsSqlite(ctx.db, { term, limit })

      const users = results.map((result) => ({
        did: result.did,
        declaration: getDeclarationSimple(result),
        handle: result.handle,
        displayName: result.displayName ?? undefined,
        avatar: result.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', result.avatarCid)
          : undefined,
      }))

      return {
        encoding: 'application/json',
        body: {
          users,
        },
      }
    },
  })
}

const getResultsPg: GetResultsFn = async (db, { term, limit }) => {
  return await getUserSearchQueryPg(db, { term: term || '', limit })
    .leftJoin('profile', 'profile.creator', 'did_handle.did')
    .select([
      'did_handle.did as did',
      'did_handle.declarationCid as declarationCid',
      'did_handle.actorType as actorType',
      'did_handle.handle as handle',
      'profile.displayName as displayName',
      'profile.avatarCid as avatarCid',
    ])
    .execute()
}

const getResultsSqlite: GetResultsFn = async (db, { term, limit }) => {
  return await getUserSearchQuerySqlite(db, { term: term || '', limit })
    .leftJoin('profile', 'profile.creator', 'did_handle.did')
    .select([
      'did_handle.did as did',
      'did_handle.declarationCid as declarationCid',
      'did_handle.actorType as actorType',
      'did_handle.handle as handle',
      'profile.displayName as displayName',
      'profile.avatarCid as avatarCid',
    ])
    .execute()
}

type GetResultsFn = (
  db: Database,
  opts: Method.QueryParams & { limit: number },
) => Promise<
  {
    did: string
    declarationCid: string
    actorType: string
    handle: string
    displayName: string | null
    avatarCid: string | null
  }[]
>
