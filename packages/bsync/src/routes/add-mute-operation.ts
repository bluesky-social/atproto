import { Code, ConnectError, type ServiceImpl } from '@connectrpc/connect'
import { sql } from 'kysely'
import { AtUri } from '@atproto/syntax'
import type { AppContext } from '../context.js'
import type { Database } from '../db/index.js'
import { createMuteOpChannel } from '../db/schema/mute_op.js'
import type { Service } from '../proto/bsync_connect.js'
import {
  AddMuteOperationResponse,
  type MuteKind,
  MuteOperation_Type,
} from '../proto/bsync_pb.js'
import { authWithApiKey } from './auth.js'
import { muteKindsFromString, muteKindsToString } from './mute-kinds.js'
import { isValidAtUri, isValidDid } from './util.js'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async addMuteOperation(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)
    const { db } = ctx
    const op = validMuteOp(req)
    const id = await db.transaction(async (txn) => {
      // create mute op
      const id = await createMuteOp(txn, op)
      // update mute state
      if (op.type === MuteOperation_Type.ADD) {
        await addMuteItem(txn, id, op)
      } else if (op.type === MuteOperation_Type.REMOVE) {
        await removeMuteItem(txn, op)
      } else if (op.type === MuteOperation_Type.CLEAR) {
        await clearMuteItems(txn, op)
      } else {
        const exhaustiveCheck: never = op.type
        throw new Error(`unreachable: ${exhaustiveCheck}`)
      }
      return id
    })
    return new AddMuteOperationResponse({
      operation: {
        id: String(id),
        type: op.type,
        actorDid: op.actorDid,
        subject: op.subject,
        kinds: muteKindsFromString(op.kinds),
      },
    })
  },
})

const createMuteOp = async (db: Database, op: MuteOpInfoValid) => {
  const { ref } = db.db.dynamic
  const { id } = await db.db
    .insertInto('mute_op')
    .values({
      type: op.type,
      actorDid: op.actorDid,
      subject: op.subject,
      kinds: op.kinds,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await sql`notify ${ref(createMuteOpChannel)}`.execute(db.db) // emitted transactionally
  return id
}

const addMuteItem = async (
  db: Database,
  fromId: number,
  op: MuteOpInfoValid,
) => {
  const { ref } = db.db.dynamic
  await db.db
    .insertInto('mute_item')
    .values({
      actorDid: op.actorDid,
      subject: op.subject,
      fromId,
      kinds: op.kinds,
    })
    .onConflict((oc) =>
      oc.constraint('mute_item_pkey').doUpdateSet({
        fromId: sql`${ref('excluded.fromId')}`,
        kinds: sql`${ref('excluded.kinds')}`,
      }),
    )
    .execute()
}

const removeMuteItem = async (db: Database, op: MuteOpInfoValid) => {
  await db.db
    .deleteFrom('mute_item')
    .where('actorDid', '=', op.actorDid)
    .where('subject', '=', op.subject)
    .execute()
}

const clearMuteItems = async (db: Database, op: MuteOpInfoValid) => {
  await db.db
    .deleteFrom('mute_item')
    .where('actorDid', '=', op.actorDid)
    .execute()
}

const validMuteOp = (op: MuteOpInfo): MuteOpInfoValid => {
  if (!Object.values(MuteOperation_Type).includes(op.type)) {
    throw new ConnectError('bad mute operation type', Code.InvalidArgument)
  }
  const kinds = muteKindsToString(op.kinds ?? [])
  if (op.type === MuteOperation_Type.UNSPECIFIED) {
    throw new ConnectError(
      'unspecified mute operation type',
      Code.InvalidArgument,
    )
  }
  if (!isValidDid(op.actorDid)) {
    throw new ConnectError(
      'actor_did must be a valid did',
      Code.InvalidArgument,
    )
  }
  if (op.type === MuteOperation_Type.CLEAR) {
    if (op.subject !== '') {
      throw new ConnectError(
        'subject must not be set on a clear op',
        Code.InvalidArgument,
      )
    }
  } else {
    if (isValidDid(op.subject)) {
      // all good
    } else if (isValidAtUri(op.subject)) {
      if (kinds !== '') {
        throw new ConnectError(
          'mute kinds only apply to actor mutes',
          Code.InvalidArgument,
        )
      }
      const uri = new AtUri(op.subject)
      if (
        uri.collection !== 'app.bsky.graph.list' &&
        uri.collection !== 'app.bsky.feed.post'
      ) {
        throw new ConnectError(
          'subject aturis must reference a list or post record',
          Code.InvalidArgument,
        )
      }
    } else {
      throw new ConnectError(
        'subject must be a did or aturi on add or remove op',
        Code.InvalidArgument,
      )
    }
  }
  return { ...op, kinds } as MuteOpInfoValid // op.type has been checked
}

type MuteOpInfo = {
  type: MuteOperation_Type
  actorDid: string
  subject: string
  kinds?: MuteKind[]
}

type MuteOpInfoValid = {
  type:
    | MuteOperation_Type.ADD
    | MuteOperation_Type.REMOVE
    | MuteOperation_Type.CLEAR
  actorDid: string
  subject: string
  kinds: string // comma-separated kind names; empty means a full mute
}
