/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type Auth,
  type Options as XrpcOptions,
  Server as XrpcServer,
  type StreamConfigOrHandler,
  type MethodConfigOrHandler,
  createServer as createXrpcServer,
} from '@atproto/xrpc-server'
import { Server } from '../../../index.js'
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
  _server: Server
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

  constructor(server: Server) {
    this._server = server
    this.communication = new ToolsOzoneCommunicationNS(server)
    this.hosting = new ToolsOzoneHostingNS(server)
    this.moderation = new ToolsOzoneModerationNS(server)
    this.safelink = new ToolsOzoneSafelinkNS(server)
    this.server = new ToolsOzoneServerNS(server)
    this.set = new ToolsOzoneSetNS(server)
    this.setting = new ToolsOzoneSettingNS(server)
    this.signature = new ToolsOzoneSignatureNS(server)
    this.team = new ToolsOzoneTeamNS(server)
    this.verification = new ToolsOzoneVerificationNS(server)
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
