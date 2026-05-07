/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import { ErrorFrame } from '@atproto/xrpc-server'
import { IncomingMessage } from 'node:http'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.moderation.subscribeModEvents'

export type QueryParams = {
  /** The last known event seq number to backfill from. Use '2222222222222' to backfill from the beginning. Don't specify a cursor to listen only for new events. */
  cursor?: string
}
export type OutputSchema = $Typed<EventConvoFirstMessage> | { $type: string }
export type HandlerError = ErrorFrame<'FutureCursor' | 'ConsumerTooSlow'>
export type HandlerOutput = HandlerError | OutputSchema

export interface EventConvoFirstMessage {
  $type?: 'chat.bsky.moderation.subscribeModEvents#eventConvoFirstMessage'
  convoId: string
  createdAt: string
  messageId?: string
  /** The list of DIDs message recipients. Does not include the sender, which is in the `user` field */
  recipients: string[]
  rev: string
  /** The DID of the message author. */
  user: string
}

const hashEventConvoFirstMessage = 'eventConvoFirstMessage'

export function isEventConvoFirstMessage<V>(v: V) {
  return is$typed(v, id, hashEventConvoFirstMessage)
}

export function validateEventConvoFirstMessage<V>(v: V) {
  return validate<EventConvoFirstMessage & V>(v, id, hashEventConvoFirstMessage)
}
