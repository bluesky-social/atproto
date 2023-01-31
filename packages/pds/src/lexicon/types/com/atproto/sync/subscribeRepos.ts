/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'
import { IncomingMessage } from 'http'

export interface QueryParams {
  dids: string[]
  /** The sequence number of the last seen repo update. */
  lastSeen: number
}

export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  req: IncomingMessage
}) => AsyncIterable<unknown>
