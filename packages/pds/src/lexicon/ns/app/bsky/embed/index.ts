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
import * as AppBskyEmbedExternal from '../../../../types/app/bsky/embed/external.js'
import * as AppBskyEmbedImages from '../../../../types/app/bsky/embed/images.js'
import * as AppBskyEmbedRecord from '../../../../types/app/bsky/embed/record.js'
import * as AppBskyEmbedRecordWithMedia from '../../../../types/app/bsky/embed/recordWithMedia.js'
import * as AppBskyEmbedVideo from '../../../../types/app/bsky/embed/video.js'
import { Server } from '../../../../index.js'

export class AppBskyEmbedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}
