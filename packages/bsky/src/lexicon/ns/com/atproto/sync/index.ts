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
import * as ComAtprotoSyncGetBlob from '../../../../types/com/atproto/sync/getBlob.js'
import * as ComAtprotoSyncGetBlocks from '../../../../types/com/atproto/sync/getBlocks.js'
import * as ComAtprotoSyncGetCheckout from '../../../../types/com/atproto/sync/getCheckout.js'
import * as ComAtprotoSyncGetHead from '../../../../types/com/atproto/sync/getHead.js'
import * as ComAtprotoSyncGetHostStatus from '../../../../types/com/atproto/sync/getHostStatus.js'
import * as ComAtprotoSyncGetLatestCommit from '../../../../types/com/atproto/sync/getLatestCommit.js'
import * as ComAtprotoSyncGetRecord from '../../../../types/com/atproto/sync/getRecord.js'
import * as ComAtprotoSyncGetRepo from '../../../../types/com/atproto/sync/getRepo.js'
import * as ComAtprotoSyncGetRepoStatus from '../../../../types/com/atproto/sync/getRepoStatus.js'
import * as ComAtprotoSyncListBlobs from '../../../../types/com/atproto/sync/listBlobs.js'
import * as ComAtprotoSyncListHosts from '../../../../types/com/atproto/sync/listHosts.js'
import * as ComAtprotoSyncListRepos from '../../../../types/com/atproto/sync/listRepos.js'
import * as ComAtprotoSyncListReposByCollection from '../../../../types/com/atproto/sync/listReposByCollection.js'
import * as ComAtprotoSyncNotifyOfUpdate from '../../../../types/com/atproto/sync/notifyOfUpdate.js'
import * as ComAtprotoSyncRequestCrawl from '../../../../types/com/atproto/sync/requestCrawl.js'
import * as ComAtprotoSyncSubscribeRepos from '../../../../types/com/atproto/sync/subscribeRepos.js'
import { Server } from '../../../../index.js'

export class ComAtprotoSyncNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getBlob<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetBlob.QueryParams,
      ComAtprotoSyncGetBlob.HandlerInput,
      ComAtprotoSyncGetBlob.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getBlob' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getBlocks<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetBlocks.QueryParams,
      ComAtprotoSyncGetBlocks.HandlerInput,
      ComAtprotoSyncGetBlocks.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getBlocks' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getCheckout<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetCheckout.QueryParams,
      ComAtprotoSyncGetCheckout.HandlerInput,
      ComAtprotoSyncGetCheckout.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getCheckout' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getHead<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetHead.QueryParams,
      ComAtprotoSyncGetHead.HandlerInput,
      ComAtprotoSyncGetHead.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getHead' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getHostStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetHostStatus.QueryParams,
      ComAtprotoSyncGetHostStatus.HandlerInput,
      ComAtprotoSyncGetHostStatus.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getHostStatus' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getLatestCommit<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetLatestCommit.QueryParams,
      ComAtprotoSyncGetLatestCommit.HandlerInput,
      ComAtprotoSyncGetLatestCommit.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getLatestCommit' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetRecord.QueryParams,
      ComAtprotoSyncGetRecord.HandlerInput,
      ComAtprotoSyncGetRecord.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetRepo.QueryParams,
      ComAtprotoSyncGetRepo.HandlerInput,
      ComAtprotoSyncGetRepo.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRepoStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncGetRepoStatus.QueryParams,
      ComAtprotoSyncGetRepoStatus.HandlerInput,
      ComAtprotoSyncGetRepoStatus.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.getRepoStatus' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listBlobs<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncListBlobs.QueryParams,
      ComAtprotoSyncListBlobs.HandlerInput,
      ComAtprotoSyncListBlobs.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.listBlobs' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listHosts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncListHosts.QueryParams,
      ComAtprotoSyncListHosts.HandlerInput,
      ComAtprotoSyncListHosts.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.listHosts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listRepos<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncListRepos.QueryParams,
      ComAtprotoSyncListRepos.HandlerInput,
      ComAtprotoSyncListRepos.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.listRepos' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listReposByCollection<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncListReposByCollection.QueryParams,
      ComAtprotoSyncListReposByCollection.HandlerInput,
      ComAtprotoSyncListReposByCollection.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.listReposByCollection' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  notifyOfUpdate<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncNotifyOfUpdate.QueryParams,
      ComAtprotoSyncNotifyOfUpdate.HandlerInput,
      ComAtprotoSyncNotifyOfUpdate.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.notifyOfUpdate' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestCrawl<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoSyncRequestCrawl.QueryParams,
      ComAtprotoSyncRequestCrawl.HandlerInput,
      ComAtprotoSyncRequestCrawl.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.requestCrawl' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  subscribeRepos<A extends Auth = void>(
    cfg: StreamConfigOrHandler<
      A,
      ComAtprotoSyncSubscribeRepos.QueryParams,
      ComAtprotoSyncSubscribeRepos.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.sync.subscribeRepos' // @ts-ignore
    return this._server.xrpc.streamMethod(nsid, cfg)
  }
}
