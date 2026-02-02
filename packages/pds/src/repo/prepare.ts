import { TID } from '@atproto/common'
import { RecordSchema } from '@atproto/lex'
import { encode } from '@atproto/lex-cbor'
import {
  BlobRef,
  Cid,
  LexMap,
  TypedLexMap,
  cidForCbor,
  enumBlobRefs,
} from '@atproto/lex-data'
import {
  RecordCreateOp,
  RecordDeleteOp,
  RecordUpdateOp,
  RecordWriteOp,
  WriteOpAction,
} from '@atproto/repo'
import {
  AtUri,
  NsidString,
  RecordKeyString,
  isValidRecordKey,
} from '@atproto/syntax'
import { hasExplicitSlur } from '../handle/explicit-slurs'
import { app, chat, com } from '../lexicons/index.js'
import {
  InvalidRecordError,
  PreparedCreate,
  PreparedDelete,
  PreparedUpdate,
  PreparedWrite,
  ValidationStatus,
} from './types'

// @TODO replace this with automatically fetched (& built) schemas
const knownSchemas = new Map<string, RecordSchema>(
  [
    app.bsky.actor.profile.main,
    app.bsky.actor.status.main,
    app.bsky.feed.generator.main,
    app.bsky.feed.like.main,
    app.bsky.feed.post.main,
    app.bsky.feed.postgate.main,
    app.bsky.feed.repost.main,
    app.bsky.feed.threadgate.main,
    app.bsky.graph.block.main,
    app.bsky.graph.follow.main,
    app.bsky.graph.list.main,
    app.bsky.graph.listblock.main,
    app.bsky.graph.listitem.main,
    app.bsky.graph.starterpack.main,
    app.bsky.graph.verification.main,
    app.bsky.labeler.service.main,
    app.bsky.notification.declaration.main,
    chat.bsky.actor.declaration.main,
    com.atproto.lexicon.schema.main,
    com.germnetwork.declaration.main,
  ].map((schema: RecordSchema) => [schema.$type, schema]),
)

const validateRecord = (
  record: TypedLexMap,
  rkey: RecordKeyString,
  opts: { validate?: boolean },
): undefined | ValidationStatus => {
  // If validation is explicitly disabled, skip it
  if (opts.validate === false) {
    return undefined
  }

  // @TODO add support for lexicon resolution to fetch the schema dynamically
  const schema = knownSchemas.get(record.$type)
  if (!schema) {
    // If validation is explicitly requested, throw if unable to validate
    if (opts.validate === true) {
      throw new InvalidRecordError(`Unknown lexicon type: ${record.$type}`)
    } else {
      return 'unknown'
    }
  }

  const rkeyResult = schema.keySchema.safeValidate(rkey)
  if (!rkeyResult.success) {
    throw new InvalidRecordError(
      `Invalid record key for ${record.$type}: ${rkeyResult.reason.message}`,
      { cause: rkeyResult.reason },
    )
  }

  const recordResult = schema.safeValidate(record)
  if (!recordResult.success) {
    throw new InvalidRecordError(
      `Invalid ${record.$type} record: ${recordResult.reason.message}`,
      { cause: recordResult.reason },
    )
  }

  return 'valid'
}

export const prepareCreate = async (opts: {
  did: string
  collection: NsidString
  rkey?: RecordKeyString
  swapCid?: Cid | null
  record: LexMap
  validate?: boolean
}): Promise<PreparedCreate> => {
  const { cid, uri, record, blobs, validationStatus } = await prepareWrite(opts)

  return {
    action: WriteOpAction.Create,
    uri,
    cid,
    swapCid: opts.swapCid,
    record,
    blobs,
    validationStatus,
  }
}

export const prepareUpdate = async (opts: {
  did: string
  collection: NsidString
  rkey: RecordKeyString
  swapCid?: Cid | null
  record: LexMap
  validate?: boolean
}): Promise<PreparedUpdate> => {
  const { cid, uri, record, blobs, validationStatus } = await prepareWrite(opts)

  return {
    action: WriteOpAction.Update,
    uri,
    cid,
    swapCid: opts.swapCid,
    record,
    blobs,
    validationStatus,
  }
}

async function prepareWrite(opts: {
  did: string
  collection: NsidString
  rkey?: RecordKeyString
  record: LexMap
  validate?: boolean
}): Promise<{
  record: TypedLexMap
  blobs: BlobRef[]
  validationStatus?: ValidationStatus
  uri: AtUri
  cid: Cid
}> {
  const record: null | TypedLexMap =
    opts.record.$type === undefined
      ? { ...opts.record, $type: opts.collection }
      : opts.record.$type === opts.collection
        ? (opts.record as TypedLexMap)
        : null

  if (!record) {
    throw new InvalidRecordError(
      `Invalid $type: expected ${opts.collection}, got ${opts.record.$type}`,
    )
  }

  // @NOTE the rkey will be validated against the schema later
  if (opts.rkey != null) {
    if (!isValidRecordKey(opts.rkey)) {
      throw new InvalidRecordError(`Invalid record key: ${opts.rkey}`)
    }
    if (hasExplicitSlur(opts.rkey)) {
      throw new InvalidRecordError('Unacceptable slur in record key')
    }
  }

  const nextRkey = TID.next()
  const rkey = opts.rkey || nextRkey.toString()

  return {
    record,
    blobs: Array.from(enumBlobRefs(record)),
    validationStatus: validateRecord(record, rkey, opts),
    uri: AtUri.make(opts.did, opts.collection, rkey),
    cid: await cidForCbor(encode(record)),
  }
}

export const prepareDelete = (opts: {
  did: string
  collection: NsidString
  rkey: RecordKeyString
  swapCid?: Cid | null
}): PreparedDelete => {
  const { did, collection, rkey, swapCid } = opts
  return {
    action: WriteOpAction.Delete,
    uri: AtUri.make(did, collection, rkey),
    swapCid,
  }
}

export const createWriteToOp = (write: PreparedCreate): RecordCreateOp => ({
  action: WriteOpAction.Create,
  collection: write.uri.collection,
  rkey: write.uri.rkey,
  record: write.record,
})

export const updateWriteToOp = (write: PreparedUpdate): RecordUpdateOp => ({
  action: WriteOpAction.Update,
  collection: write.uri.collection,
  rkey: write.uri.rkey,
  record: write.record,
})

export const deleteWriteToOp = (write: PreparedDelete): RecordDeleteOp => ({
  action: WriteOpAction.Delete,
  collection: write.uri.collection,
  rkey: write.uri.rkey,
})

export const writeToOp = (write: PreparedWrite): RecordWriteOp => {
  switch (write.action) {
    case WriteOpAction.Create:
      return createWriteToOp(write)
    case WriteOpAction.Update:
      return updateWriteToOp(write)
    case WriteOpAction.Delete:
      return deleteWriteToOp(write)
    default:
      throw new Error(`Unrecognized action: ${write}`)
  }
}
