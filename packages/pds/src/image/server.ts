import fs from 'fs/promises'
import path from 'path'
import express, { ErrorRequestHandler, NextFunction } from 'express'
import { InvalidRequestError, XRPCError } from '@atproto/xrpc-server'
import { BadPathError, ImageUriBuilder } from './uri'
import log from './logger'
import { Readable } from 'stream'
import { SharpImageProcessor } from './sharp'
import { forwardStreamErrors, formatsToMimes, Options } from './util'

export class ImageProcessingServer {
  app = express()
  processor = new SharpImageProcessor()
  uriBuilder: ImageUriBuilder

  constructor(
    protected salt: Uint8Array,
    protected key: Uint8Array,
    protected storage: BlobStorage,
  ) {
    this.uriBuilder = new ImageUriBuilder(salt, key)
    this.app.get('*', this.handler.bind(this))
    this.app.use(errorMiddleware)
  }

  async handler(
    req: express.Request,
    res: express.Response,
    next: NextFunction,
  ) {
    try {
      const path = req.path
      const options = this.uriBuilder.getVerifiedOptions(path)
      const imageStream = await this.storage.get(options.fileId)
      const processedImage = await this.processor.resize(imageStream, options)
      res.statusCode = 200
      res.setHeader('content-type', getMime(options.format))
      res.setHeader('cache-control', `public, max-age=31536000`) // 1 year
      forwardStreamErrors(processedImage, res)
      return (
        processedImage
          // @NOTE sharp does emit this in time to be set as a header
          .once('info', (info) => res.setHeader('content-length', info.size))
          .pipe(res)
      )
    } catch (err: unknown) {
      if (err instanceof BadPathError) {
        return next(new InvalidRequestError(err.message))
      }
      if (err instanceof BlobNotFoundError) {
        return next(new XRPCError(404, 'Image not found', 'NotFound'))
      }
      return next(err)
    }
  }
}

const errorMiddleware: ErrorRequestHandler = function (err, req, res, next) {
  if (err instanceof XRPCError) {
    log.error(err, `error: ${err.message}`)
  } else {
    log.error(err, 'unhandled exception')
  }
  if (res.headersSent) {
    return next(err)
  }
  const xrpcError = XRPCError.fromError(err)
  return res.status(xrpcError.type).json(xrpcError.payload)
}

function getMime(format: Options['format']) {
  const mime = formatsToMimes[format]
  if (!mime) throw new Error('Unknown format')
  return mime
}

export interface BlobStorage {
  get(fileId: string): Promise<Readable>
}

export class BlobNotFoundError extends Error {}

export class BlobDiskStorage implements BlobStorage {
  constructor(public basePath: string) {
    if (!path.isAbsolute(this.basePath)) {
      throw new Error('Must provide an absolute path')
    }
  }

  async get(fileId: string) {
    try {
      const handle = await fs.open(path.join(this.basePath, fileId), 'r')
      return handle.createReadStream()
    } catch (err) {
      if (isErrnoException(err) && err.code === 'ENOENT') {
        throw new BlobNotFoundError()
      }
      throw err
    }
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return !!err && 'code' in err
}
