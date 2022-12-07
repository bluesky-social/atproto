import fs from 'fs/promises'
import fsSync from 'fs'
import os from 'os'
import path from 'path'
import { PassThrough, Readable } from 'stream'
import express, { ErrorRequestHandler, NextFunction } from 'express'
import createError, { isHttpError } from 'http-errors'
import { BadPathError, ImageUriBuilder } from './uri'
import log from './logger'
import { resize } from './sharp'
import { forwardStreamErrors, formatsToMimes, Options } from './util'

export class ImageProcessingServer {
  app = express()
  uriBuilder: ImageUriBuilder

  constructor(
    protected salt: Uint8Array,
    protected key: Uint8Array,
    protected storage: BlobStorage,
    public cache: BlobCache,
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

      const imageStream = await this.storage.get(options.fileId)
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

export interface BlobCache extends BlobStorage {
  get(fileId: string): Promise<Readable & { size: number }>
  put(fileId: string, stream: Readable): Promise<void>
  clear(): Promise<void>
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
    try {
      const handle = await fs.open(path.join(this.tempDir, fileId), 'r')
      const { size } = await handle.stat()
      return Object.assign(handle.createReadStream(), { size })
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

  async clear() {
    await fs.rm(this.tempDir, { recursive: true, force: true })
  }
}

function cloneStream(stream: Readable) {
  const passthrough = new PassThrough()
  forwardStreamErrors(stream, passthrough)
  return stream.pipe(passthrough)
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return !!err && 'code' in err
}
