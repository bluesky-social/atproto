import { InvalidRequestError } from '@atproto/xrpc-server'
import { jsonStringToLex } from '@atproto/lexicon'
import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/notification/listNotifications'
import AppContext from '../../../../context'
import { Database } from '../../../../db'
import { notSoftDeletedClause } from '../../../../db/util'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import { BlockAndMuteState, GraphService } from '../../../../services/graph'
import { ActorInfoMap, ActorService } from '../../../../services/actor'
import { getSelfLabels, Labels, LabelService } from '../../../../services/label'
import { createPipeline } from '../../../../pipeline'

export default function (server: Server, ctx: AppContext) {
  const listNotifications = createPipeline(
    skeleton,
    hydration,
    noBlockOrMutes,
    presentation,
  )
  server.app.bsky.notification.listNotifications({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth }) => {
      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const graphService = ctx.services.graph(db)
      const labelService = ctx.services.label(db)
      const viewer = auth.credentials.iss

      const result = await listNotifications(
        { ...params, viewer },
        { db, actorService, graphService, labelService },
      )

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (
  params: Params,
  ctx: Context,
): Promise<SkeletonState> => {
  const { db } = ctx
  const { limit, cursor, viewer } = params
  const { ref } = db.db.dynamic
  if (params.seenAt) {
    throw new InvalidRequestError('The seenAt parameter is unsupported')
  }
  if (NotifsKeyset.clearlyBad(cursor)) {
    return { params, notifs: [] }
  }
  let notifBuilder = db.db
    .selectFrom('notification as notif')
    .where('notif.did', '=', viewer)
    .where((clause) =>
      clause
        .where('reasonSubject', 'is', null)
        .orWhereExists(
          db.db
            .selectFrom('record as subject')
            .selectAll()
            .whereRef('subject.uri', '=', ref('notif.reasonSubject')),
        ),
    )
    .select([
      'notif.author as authorDid',
      'notif.recordUri as uri',
      'notif.recordCid as cid',
      'notif.reason as reason',
      'notif.reasonSubject as reasonSubject',
      'notif.sortAt as indexedAt',
    ])

  const keyset = new NotifsKeyset(ref('notif.sortAt'), ref('notif.recordCid'))
  notifBuilder = paginate(notifBuilder, {
    cursor,
    limit,
    keyset,
    tryIndex: true,
  })

  const actorStateQuery = db.db
    .selectFrom('actor_state')
    .selectAll()
    .where('did', '=', viewer)

  const [notifs, actorState] = await Promise.all([
    notifBuilder.execute(),
    actorStateQuery.executeTakeFirst(),
  ])

  return {
    params,
    notifs,
    cursor: keyset.packFromResult(notifs),
    lastSeenNotifs: actorState?.lastSeenNotifs,
  }
}

const hydration = async (state: SkeletonState, ctx: Context) => {
  const { graphService, actorService, labelService, db } = ctx
  const { params, notifs } = state
  const { viewer } = params
  const dids = notifs.map((notif) => notif.authorDid)
  const uris = notifs.map((notif) => notif.uri)
  const [actors, records, labels, bam] = await Promise.all([
    actorService.views.profiles(dids, viewer),
    getRecordMap(db, uris),
    labelService.getLabelsForUris(uris),
    graphService.getBlockAndMuteState(dids.map((did) => [viewer, did])),
  ])
  return { ...state, actors, records, labels, bam }
}

const noBlockOrMutes = (state: HydrationState) => {
  const { viewer } = state.params
  state.notifs = state.notifs.filter(
    (item) =>
      !state.bam.block([viewer, item.authorDid]) &&
      !state.bam.mute([viewer, item.authorDid]),
  )
  return state
}

const presentation = (state: HydrationState) => {
  const { notifs, cursor, actors, records, labels, lastSeenNotifs } = state
  const notifications = mapDefined(notifs, (notif) => {
    const author = actors[notif.authorDid]
    const record = records[notif.uri]
    if (!author || !record) return undefined
    const recordLabels = labels[notif.uri] ?? []
    const recordSelfLabels = getSelfLabels({
      uri: notif.uri,
      cid: notif.cid,
      record,
    })
    return {
      uri: notif.uri,
      cid: notif.cid,
      author,
      reason: notif.reason,
      reasonSubject: notif.reasonSubject || undefined,
      record,
      isRead: lastSeenNotifs ? notif.indexedAt <= lastSeenNotifs : false,
      indexedAt: notif.indexedAt,
      labels: [...recordLabels, ...recordSelfLabels],
    }
  })
  return { notifications, cursor, seenAt: lastSeenNotifs }
}

const getRecordMap = async (
  db: Database,
  uris: string[],
): Promise<RecordMap> => {
  if (!uris.length) return {}
  const { ref } = db.db.dynamic
  const recordRows = await db.db
    .selectFrom('record')
    .select(['uri', 'json'])
    .where('uri', 'in', uris)
    .where(notSoftDeletedClause(ref('record')))
    .execute()
  return recordRows.reduce((acc, { uri, json }) => {
    acc[uri] = jsonStringToLex(json) as Record<string, unknown>
    return acc
  }, {} as RecordMap)
}

type Context = {
  db: Database
  actorService: ActorService
  graphService: GraphService
  labelService: LabelService
}

type Params = QueryParams & {
  viewer: string
}

type SkeletonState = {
  params: Params
  notifs: NotifRow[]
  lastSeenNotifs?: string
  cursor?: string
}

type HydrationState = SkeletonState & {
  bam: BlockAndMuteState
  actors: ActorInfoMap
  records: RecordMap
  labels: Labels
}

type RecordMap = { [uri: string]: Record<string, unknown> }

type NotifRow = {
  authorDid: string
  uri: string
  cid: string
  reason: string
  reasonSubject: string | null
  indexedAt: string
}

class NotifsKeyset extends TimeCidKeyset<NotifRow> {
  labelResult(result: NotifRow) {
    return { primary: result.indexedAt, secondary: result.cid }
  }
}
