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
import * as ComAtprotoTempAddReservedHandle from '../../../../types/com/atproto/temp/addReservedHandle.js'
import * as ComAtprotoTempCheckHandleAvailability from '../../../../types/com/atproto/temp/checkHandleAvailability.js'
import * as ComAtprotoTempCheckSignupQueue from '../../../../types/com/atproto/temp/checkSignupQueue.js'
import * as ComAtprotoTempFetchLabels from '../../../../types/com/atproto/temp/fetchLabels.js'
import * as ComAtprotoTempRequestPhoneVerification from '../../../../types/com/atproto/temp/requestPhoneVerification.js'
import { Server } from '../../../../index.js'

export class ComAtprotoTempNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  addReservedHandle<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempAddReservedHandle.QueryParams,
      ComAtprotoTempAddReservedHandle.HandlerInput,
      ComAtprotoTempAddReservedHandle.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.addReservedHandle' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  checkHandleAvailability<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempCheckHandleAvailability.QueryParams,
      ComAtprotoTempCheckHandleAvailability.HandlerInput,
      ComAtprotoTempCheckHandleAvailability.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.checkHandleAvailability' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  checkSignupQueue<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempCheckSignupQueue.QueryParams,
      ComAtprotoTempCheckSignupQueue.HandlerInput,
      ComAtprotoTempCheckSignupQueue.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.checkSignupQueue' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  fetchLabels<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempFetchLabels.QueryParams,
      ComAtprotoTempFetchLabels.HandlerInput,
      ComAtprotoTempFetchLabels.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.fetchLabels' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  requestPhoneVerification<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoTempRequestPhoneVerification.QueryParams,
      ComAtprotoTempRequestPhoneVerification.HandlerInput,
      ComAtprotoTempRequestPhoneVerification.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.temp.requestPhoneVerification' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
