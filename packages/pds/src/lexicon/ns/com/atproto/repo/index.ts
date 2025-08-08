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
import * as ComAtprotoRepoApplyWrites from '../../../../types/com/atproto/repo/applyWrites.js'
import * as ComAtprotoRepoCreateRecord from '../../../../types/com/atproto/repo/createRecord.js'
import * as ComAtprotoRepoDeleteRecord from '../../../../types/com/atproto/repo/deleteRecord.js'
import * as ComAtprotoRepoDescribeRepo from '../../../../types/com/atproto/repo/describeRepo.js'
import * as ComAtprotoRepoGetRecord from '../../../../types/com/atproto/repo/getRecord.js'
import * as ComAtprotoRepoImportRepo from '../../../../types/com/atproto/repo/importRepo.js'
import * as ComAtprotoRepoListMissingBlobs from '../../../../types/com/atproto/repo/listMissingBlobs.js'
import * as ComAtprotoRepoListRecords from '../../../../types/com/atproto/repo/listRecords.js'
import * as ComAtprotoRepoPutRecord from '../../../../types/com/atproto/repo/putRecord.js'
import * as ComAtprotoRepoStrongRef from '../../../../types/com/atproto/repo/strongRef.js'
import * as ComAtprotoRepoUploadBlob from '../../../../types/com/atproto/repo/uploadBlob.js'
import { Server } from '../../../../index.js'

export class ComAtprotoRepoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  applyWrites<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoApplyWrites.QueryParams,
      ComAtprotoRepoApplyWrites.HandlerInput,
      ComAtprotoRepoApplyWrites.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.applyWrites' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoCreateRecord.QueryParams,
      ComAtprotoRepoCreateRecord.HandlerInput,
      ComAtprotoRepoCreateRecord.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.createRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoDeleteRecord.QueryParams,
      ComAtprotoRepoDeleteRecord.HandlerInput,
      ComAtprotoRepoDeleteRecord.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.deleteRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  describeRepo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoDescribeRepo.QueryParams,
      ComAtprotoRepoDescribeRepo.HandlerInput,
      ComAtprotoRepoDescribeRepo.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.describeRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoGetRecord.QueryParams,
      ComAtprotoRepoGetRecord.HandlerInput,
      ComAtprotoRepoGetRecord.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.getRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  importRepo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoImportRepo.QueryParams,
      ComAtprotoRepoImportRepo.HandlerInput,
      ComAtprotoRepoImportRepo.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.importRepo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listMissingBlobs<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoListMissingBlobs.QueryParams,
      ComAtprotoRepoListMissingBlobs.HandlerInput,
      ComAtprotoRepoListMissingBlobs.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.listMissingBlobs' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listRecords<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoListRecords.QueryParams,
      ComAtprotoRepoListRecords.HandlerInput,
      ComAtprotoRepoListRecords.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.listRecords' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoPutRecord.QueryParams,
      ComAtprotoRepoPutRecord.HandlerInput,
      ComAtprotoRepoPutRecord.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.putRecord' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  uploadBlob<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoUploadBlob.QueryParams,
      ComAtprotoRepoUploadBlob.HandlerInput,
      ComAtprotoRepoUploadBlob.HandlerOutput
    >,
  ) {
    const nsid = 'com.atproto.repo.uploadBlob' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
