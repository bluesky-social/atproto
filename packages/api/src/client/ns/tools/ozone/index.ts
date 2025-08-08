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
import { ToolsOzoneCommunicationNS } from './communication/index.js'
import { ToolsOzoneHostingNS } from './hosting/index.js'
import { ToolsOzoneModerationNS } from './moderation/index.js'
import { ToolsOzoneSafelinkNS } from './safelink/index.js'
import { ToolsOzoneServerNS } from './server/index.js'
import { ToolsOzoneSetNS } from './set/index.js'
import { ToolsOzoneSettingNS } from './setting/index.js'
import { ToolsOzoneSignatureNS } from './signature/index.js'
import { ToolsOzoneTeamNS } from './team/index.js'
import { ToolsOzoneVerificationNS } from './verification/index.js'

export class ToolsOzoneNS {
  _client: XrpcClient
  communication: ToolsOzoneCommunicationNS
  hosting: ToolsOzoneHostingNS
  moderation: ToolsOzoneModerationNS
  safelink: ToolsOzoneSafelinkNS
  server: ToolsOzoneServerNS
  set: ToolsOzoneSetNS
  setting: ToolsOzoneSettingNS
  signature: ToolsOzoneSignatureNS
  team: ToolsOzoneTeamNS
  verification: ToolsOzoneVerificationNS

  constructor(client: XrpcClient) {
    this._client = client
    this.communication = new ToolsOzoneCommunicationNS(client)
    this.hosting = new ToolsOzoneHostingNS(client)
    this.moderation = new ToolsOzoneModerationNS(client)
    this.safelink = new ToolsOzoneSafelinkNS(client)
    this.server = new ToolsOzoneServerNS(client)
    this.set = new ToolsOzoneSetNS(client)
    this.setting = new ToolsOzoneSettingNS(client)
    this.signature = new ToolsOzoneSignatureNS(client)
    this.team = new ToolsOzoneTeamNS(client)
    this.verification = new ToolsOzoneVerificationNS(client)
  }
}

export * from './communication/index.js'
export * from './hosting/index.js'
export * from './moderation/index.js'
export * from './safelink/index.js'
export * from './server/index.js'
export * from './set/index.js'
export * from './setting/index.js'
export * from './signature/index.js'
export * from './team/index.js'
export * from './verification/index.js'
