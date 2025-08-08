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
import * as ComAtprotoIdentityGetRecommendedDidCredentials from '../../../../types/com/atproto/identity/getRecommendedDidCredentials.js'
import * as ComAtprotoIdentityRefreshIdentity from '../../../../types/com/atproto/identity/refreshIdentity.js'
import * as ComAtprotoIdentityRequestPlcOperationSignature from '../../../../types/com/atproto/identity/requestPlcOperationSignature.js'
import * as ComAtprotoIdentityResolveDid from '../../../../types/com/atproto/identity/resolveDid.js'
import * as ComAtprotoIdentityResolveHandle from '../../../../types/com/atproto/identity/resolveHandle.js'
import * as ComAtprotoIdentityResolveIdentity from '../../../../types/com/atproto/identity/resolveIdentity.js'
import * as ComAtprotoIdentitySignPlcOperation from '../../../../types/com/atproto/identity/signPlcOperation.js'
import * as ComAtprotoIdentitySubmitPlcOperation from '../../../../types/com/atproto/identity/submitPlcOperation.js'
import * as ComAtprotoIdentityUpdateHandle from '../../../../types/com/atproto/identity/updateHandle.js'
import { Server } from '../../../../index.js'

export class ComAtprotoIdentityNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getRecommendedDidCredentials<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityGetRecommendedDidCredentials.QueryParams,
      ComAtprotoIdentityGetRecommendedDidCredentials.HandlerInput,
      ComAtprotoIdentityGetRecommendedDidCredentials.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.getRecommendedDidCredentials' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  refreshIdentity<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityRefreshIdentity.QueryParams,
      ComAtprotoIdentityRefreshIdentity.HandlerInput,
      ComAtprotoIdentityRefreshIdentity.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.refreshIdentity' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestPlcOperationSignature<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityRequestPlcOperationSignature.QueryParams,
      ComAtprotoIdentityRequestPlcOperationSignature.HandlerInput,
      ComAtprotoIdentityRequestPlcOperationSignature.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.requestPlcOperationSignature' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  resolveDid<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityResolveDid.QueryParams,
      ComAtprotoIdentityResolveDid.HandlerInput,
      ComAtprotoIdentityResolveDid.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.resolveDid' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  resolveHandle<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityResolveHandle.QueryParams,
      ComAtprotoIdentityResolveHandle.HandlerInput,
      ComAtprotoIdentityResolveHandle.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.resolveHandle' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  resolveIdentity<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityResolveIdentity.QueryParams,
      ComAtprotoIdentityResolveIdentity.HandlerInput,
      ComAtprotoIdentityResolveIdentity.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.resolveIdentity' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  signPlcOperation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentitySignPlcOperation.QueryParams,
      ComAtprotoIdentitySignPlcOperation.HandlerInput,
      ComAtprotoIdentitySignPlcOperation.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.signPlcOperation' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  submitPlcOperation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentitySubmitPlcOperation.QueryParams,
      ComAtprotoIdentitySubmitPlcOperation.HandlerInput,
      ComAtprotoIdentitySubmitPlcOperation.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.submitPlcOperation' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateHandle<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoIdentityUpdateHandle.QueryParams,
      ComAtprotoIdentityUpdateHandle.HandlerInput,
      ComAtprotoIdentityUpdateHandle.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.identity.updateHandle' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
