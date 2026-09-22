import type { ServiceImpl } from '@connectrpc/connect'
import { keyBy } from '@atproto/common'
import { app } from '../../../lexicons/index.js'
import type { Service } from '../../../proto/bsky_connect.js'
import type { Database } from '../db/index.js'
import { TimeCidKeyset, paginate } from '../db/pagination.js'
import { countAll } from '../db/util.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActorLists(req) {
    const { actorDid, cursor, limit } = req
    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('list')
      .where('creator', '=', actorDid)
      .selectAll()
    const keyset = new TimeCidKeyset(ref('list.sortAt'), ref('list.cid'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
    })
    const page = keyset.page(await builder.execute(), limit)
    return {
      listUris: page.items.map((item) => item.uri),
      cursor: page.cursor,
    }
  },

  async getListMembers(req) {
    const { listUri, cursor, limit, viewerDid } = req
    const { ref } = db.db.dynamic
    const list = await db.db
      .selectFrom('list')
      .where('uri', '=', listUri)
      .select(['creator', 'purpose'])
      .executeTakeFirst()
    const isReferenceList = list?.purpose === app.bsky.graph.defs.Referencelist
    const isOwner = isReferenceList && list.creator === viewerDid
    let builder = db.db
      .selectFrom('list_item')
      .where('listUri', '=', listUri)
      .selectAll()

    if (isReferenceList && !isOwner) {
      builder = builder.where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('reference_list_opt_out')
              .select('uri')
              .whereRef(
                'reference_list_opt_out.creator',
                '=',
                'list_item.subjectDid',
              )
              .where('reference_list_opt_out.subjectUri', '=', listUri),
          ),
        ),
      )
    }

    const keyset = new TimeCidKeyset(
      ref('list_item.sortAt'),
      ref('list_item.cid'),
    )

    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
    })

    const page = keyset.page(await builder.execute(), limit)
    const optedOut = new Set<string>()
    if (isOwner && page.items.length > 0) {
      const rows = await db.db
        .selectFrom('reference_list_opt_out')
        .where(
          'creator',
          'in',
          page.items.map((item) => item.subjectDid),
        )
        .where('subjectUri', '=', listUri)
        .select('creator')
        .execute()
      rows.forEach((row) => optedOut.add(row.creator))
    }
    return {
      listitems: page.items.map((item) => ({
        uri: item.uri,
        did: item.subjectDid,
        subjectOptedOut: optedOut.has(item.subjectDid),
      })),
      cursor: page.cursor,
    }
  },

  async getListMembership(req) {
    const { actorDid, listUris } = req
    if (listUris.length === 0) {
      return { listitemUris: [] }
    }
    const res = await db.db
      .selectFrom('list_item')
      .where('subjectDid', '=', actorDid)
      .where('listUri', 'in', listUris)
      .selectAll()
      .execute()
    const byListUri = keyBy(res, 'listUri')
    const listitemUris = listUris.map((uri) => byListUri.get(uri)?.uri ?? '')
    return {
      listitemUris,
    }
  },

  async getListCount(req) {
    const res = await db.db
      .selectFrom('list_item')
      .select(countAll.as('count'))
      .where('list_item.listUri', '=', req.listUri)
      .executeTakeFirst()
    return {
      count: res?.count,
    }
  },

  async getReferencelistoptoutsByActorAndSubjects(req) {
    const { actorDid, subjectUris } = req
    if (subjectUris.length === 0) return { uris: [] }
    const rows = await db.db
      .selectFrom('reference_list_opt_out')
      .innerJoin('list', 'list.uri', 'reference_list_opt_out.subjectUri')
      .where('reference_list_opt_out.creator', '=', actorDid)
      .where('reference_list_opt_out.subjectUri', 'in', subjectUris)
      .where('list.purpose', '=', app.bsky.graph.defs.Referencelist)
      .select([
        'reference_list_opt_out.subjectUri as subjectUri',
        'reference_list_opt_out.uri as uri',
      ])
      .execute()
    const bySubject = keyBy(rows, 'subjectUri')
    return { uris: subjectUris.map((uri) => bySubject.get(uri)?.uri ?? '') }
  },
})
