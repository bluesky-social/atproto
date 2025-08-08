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
import { AppBskyActorNS } from './actor/index.js'
import { AppBskyEmbedNS } from './embed/index.js'
import { AppBskyFeedNS } from './feed/index.js'
import { AppBskyGraphNS } from './graph/index.js'
import { AppBskyLabelerNS } from './labeler/index.js'
import { AppBskyNotificationNS } from './notification/index.js'
import { AppBskyRichtextNS } from './richtext/index.js'
import { AppBskyUnspeccedNS } from './unspecced/index.js'
import { AppBskyVideoNS } from './video/index.js'

export class AppBskyNS {
  _server: Server
  actor: AppBskyActorNS
  embed: AppBskyEmbedNS
  feed: AppBskyFeedNS
  graph: AppBskyGraphNS
  labeler: AppBskyLabelerNS
  notification: AppBskyNotificationNS
  richtext: AppBskyRichtextNS
  unspecced: AppBskyUnspeccedNS
  video: AppBskyVideoNS

  constructor(server: Server) {
    this._server = server
    this.actor = new AppBskyActorNS(server)
    this.embed = new AppBskyEmbedNS(server)
    this.feed = new AppBskyFeedNS(server)
    this.graph = new AppBskyGraphNS(server)
    this.labeler = new AppBskyLabelerNS(server)
    this.notification = new AppBskyNotificationNS(server)
    this.richtext = new AppBskyRichtextNS(server)
    this.unspecced = new AppBskyUnspeccedNS(server)
    this.video = new AppBskyVideoNS(server)
  }
}

export * from './actor/index.js'
export * from './embed/index.js'
export * from './feed/index.js'
export * from './graph/index.js'
export * from './labeler/index.js'
export * from './notification/index.js'
export * from './richtext/index.js'
export * from './unspecced/index.js'
export * from './video/index.js'
