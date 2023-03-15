import fs from 'fs/promises'
import fsSync from 'fs'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'
import express, { ErrorRequestHandler, NextFunction } from 'express'
import createError, { isHttpError } from 'http-errors'
import { BlobNotFoundError, BlobStore } from '@atproto/repo'
import {
  cloneStream,
  forwardStreamErrors,
  isErrnoException,
} from '@atproto/common'
import { BadPathError, ImageUriBuilder } from './uri'
import log from './logger'
import { resize } from './sharp'
import { formatsToMimes, Options } from './util'

export class ImageProcessingServer {
  app = express()
  uriBuilder: ImageUriBuilder

  constructor(
    protected salt: string | Uint8Array,
    protected key: string | Uint8Array,
    protected storage: BlobStore,
    public cache: BlobCache,
  ) {
    this.uriBuilder = new ImageUriBuilder('', salt, key)
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

      // Cached flow

      try {
        const cachedImage = await this.cache.get(options.signature)
        res.statusCode = 200
        res.setHeader('x-cache', 'hit')
        res.setHeader('content-type', getMime(options.format))
        res.setHeader('cache-control', `public, max-age=31536000`) // 1 year
        res.setHeader('content-length', cachedImage.size)
        forwardStreamErrors(cachedImage, res)
        return cachedImage.pipe(res)
      } catch (err) {
        // Ignore BlobNotFoundError and move on to non-cached flow
        if (!(err instanceof BlobNotFoundError)) throw err
      }

      // Non-cached flow

      const imageStream = await this.storage.getStream(options.cid)
      const processedImage = await resize(imageStream, options)

      // Cache in the background
      this.cache
        .put(options.signature, cloneStream(processedImage))
        .catch((err) => log.error(err, 'failed to cache image'))
      // Respond
      res.statusCode = 200
      res.setHeader('x-cache', 'miss')
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
        return next(createError(400, err))
      }
      if (err instanceof BlobNotFoundError) {
        return next(createError(404, 'Image not found'))
      }
      return next(err)
    }
  }
}

const errorMiddleware: ErrorRequestHandler = function (err, _req, res, next) {
  if (isHttpError(err)) {
    log.error(err, `error: ${err.message}`)
  } else {
    log.error(err, 'unhandled exception')
  }
  if (res.headersSent) {
    return next(err)
  }
  const httpError = createError(err)
  return res.status(httpError.status).json({
    message: httpError.expose ? httpError.message : 'Internal Server Error',
  })
}

function getMime(format: Options['format']) {
  const mime = formatsToMimes[format]
  if (!mime) throw new Error('Unknown format')
  return mime
}

export interface BlobCache {
  get(fileId: string): Promise<Readable & { size: number }>
  put(fileId: string, stream: Readable): Promise<void>
  clear(fileId: string): Promise<void>
  clearAll(): Promise<void>
}

export class BlobDiskCache implements BlobCache {
  tempDir: string
  constructor(basePath?: string) {
    this.tempDir = basePath || path.join(os.tmpdir(), 'pds--processed-images')
    if (!path.isAbsolute(this.tempDir)) {
      throw new Error('Must provide an absolute path')
    }
    try {
      fsSync.mkdirSync(this.tempDir, { recursive: true })
    } catch (err) {
      // All good if cache dir already exists
      if (isErrnoException(err) && err.code === 'EEXIST') return
    }
  }

  async get(fileId: string) {
    const filePath = path.join(this.tempDir, fileId)
    try {
      const { size } = await fs.stat(filePath)
      if (size === 0) {
        throw new BlobNotFoundError()
      }
      return Object.assign(fsSync.createReadStream(filePath), { size })
    } catch (err) {
      if (isErrnoException(err) && err.code === 'ENOENT') {
        throw new BlobNotFoundError()
      }
      throw err
    }
  }

  async put(fileId: string, stream: Readable) {
    const filename = path.join(this.tempDir, fileId)
    try {
      await fs.writeFile(filename, stream, { flag: 'wx' })
    } catch (err) {
      // Do not overwrite existing file, just ignore the error
      if (isErrnoException(err) && err.code === 'EEXIST') return
      throw err
    }
  }

  async clear(fileId: string) {
    const filename = path.join(this.tempDir, fileId)
    await fs.rm(filename, { force: true })
  }

  async clearAll() {
    await fs.rm(this.tempDir, { recursive: true, force: true })
  }
}
