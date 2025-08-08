/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  XrpcClient,
  type FetchHandler,
  type FetchHandlerOptions,
} from '@atproto/xrpc'
import { schemas } from '../../../lexicons.js'
import { CID } from 'multiformats/cid'
import { type OmitKey, type Un$Typed } from '../../../util.js'
import * as ComAtprotoRepoCreateRecord from '../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoGetRecord from '../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoListRecords from '../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../types/com/atproto/repo/putRecord.js'
import { ComAtprotoAdminNS } from './admin/index.js'
import { ComAtprotoIdentityNS } from './identity/index.js'
import { ComAtprotoLabelNS } from './label/index.js'
import { ComAtprotoLexiconNS } from './lexicon/index.js'
import { ComAtprotoModerationNS } from './moderation/index.js'
import { ComAtprotoRepoNS } from './repo/index.js'
import { ComAtprotoServerNS } from './server/index.js'
import { ComAtprotoSyncNS } from './sync/index.js'
import { ComAtprotoTempNS } from './temp/index.js'

export class ComAtprotoNS {
  _client: XrpcClient
  admin: ComAtprotoAdminNS
  identity: ComAtprotoIdentityNS
  label: ComAtprotoLabelNS
  lexicon: ComAtprotoLexiconNS
  moderation: ComAtprotoModerationNS
  repo: ComAtprotoRepoNS
  server: ComAtprotoServerNS
  sync: ComAtprotoSyncNS
  temp: ComAtprotoTempNS

  constructor(client: XrpcClient) {
    this._client = client
    this.admin = new ComAtprotoAdminNS(client)
    this.identity = new ComAtprotoIdentityNS(client)
    this.label = new ComAtprotoLabelNS(client)
    this.lexicon = new ComAtprotoLexiconNS(client)
    this.moderation = new ComAtprotoModerationNS(client)
    this.repo = new ComAtprotoRepoNS(client)
    this.server = new ComAtprotoServerNS(client)
    this.sync = new ComAtprotoSyncNS(client)
    this.temp = new ComAtprotoTempNS(client)
  }
}

export * from './admin/index.js'
export * from './identity/index.js'
export * from './label/index.js'
export * from './lexicon/index.js'
export * from './moderation/index.js'
export * from './repo/index.js'
export * from './server/index.js'
export * from './sync/index.js'
export * from './temp/index.js'
