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
import { schemas } from './lexicons.js'
import * as AppSokaaActorGetProfile from './types/app/sokaa/actor/getProfile.js'
import * as AppSokaaFeedGetAuthorFeed from './types/app/sokaa/feed/getAuthorFeed.js'
import * as AppSokaaFeedGetTimeline from './types/app/sokaa/feed/getTimeline.js'

export function createServer(options?: XrpcOptions): Server {
  return new Server(options)
}

export class Server {
  xrpc: XrpcServer
  app: AppNS

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options)
    this.app = new AppNS(this)
  }
}

export class AppNS {
  _server: Server
  sokaa: AppSokaaNS

  constructor(server: Server) {
    this._server = server
    this.sokaa = new AppSokaaNS(server)
  }
}

export class AppSokaaNS {
  _server: Server
  actor: AppSokaaActorNS
  embed: AppSokaaEmbedNS
  feed: AppSokaaFeedNS
  graph: AppSokaaGraphNS

  constructor(server: Server) {
    this._server = server
    this.actor = new AppSokaaActorNS(server)
    this.embed = new AppSokaaEmbedNS(server)
    this.feed = new AppSokaaFeedNS(server)
    this.graph = new AppSokaaGraphNS(server)
  }
}

export class AppSokaaActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getProfile<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppSokaaActorGetProfile.QueryParams,
      AppSokaaActorGetProfile.HandlerInput,
      AppSokaaActorGetProfile.HandlerOutput
    >,
  ) {
    const nsid = 'app.sokaa.actor.getProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppSokaaEmbedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class AppSokaaFeedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getAuthorFeed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppSokaaFeedGetAuthorFeed.QueryParams,
      AppSokaaFeedGetAuthorFeed.HandlerInput,
      AppSokaaFeedGetAuthorFeed.HandlerOutput
    >,
  ) {
    const nsid = 'app.sokaa.feed.getAuthorFeed' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getTimeline<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppSokaaFeedGetTimeline.QueryParams,
      AppSokaaFeedGetTimeline.HandlerInput,
      AppSokaaFeedGetTimeline.HandlerOutput
    >,
  ) {
    const nsid = 'app.sokaa.feed.getTimeline' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class AppSokaaGraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}
