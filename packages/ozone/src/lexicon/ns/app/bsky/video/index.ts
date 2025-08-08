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
import * as AppBskyVideoGetJobStatus from '../../../../types/app/bsky/video/getJobStatus.js'
import * as AppBskyVideoGetUploadLimits from '../../../../types/app/bsky/video/getUploadLimits.js'
import * as AppBskyVideoUploadVideo from '../../../../types/app/bsky/video/uploadVideo.js'
import { Server } from '../../../../index.js'

export class AppBskyVideoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getJobStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyVideoGetJobStatus.QueryParams,
      AppBskyVideoGetJobStatus.HandlerInput,
      AppBskyVideoGetJobStatus.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.video.getJobStatus' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUploadLimits<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyVideoGetUploadLimits.QueryParams,
      AppBskyVideoGetUploadLimits.HandlerInput,
      AppBskyVideoGetUploadLimits.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.video.getUploadLimits' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  uploadVideo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyVideoUploadVideo.QueryParams,
      AppBskyVideoUploadVideo.HandlerInput,
      AppBskyVideoUploadVideo.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.video.uploadVideo' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
