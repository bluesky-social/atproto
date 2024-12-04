import {
  ACCEPT_ENCODING_COMPRESSED,
  ACCEPT_ENCODING_UNCOMPRESSED,
  formatAcceptHeader,
} from '@atproto-labs/xrpc-utils'
import {
  cloneStream,
  createDecoders,
  forwardStreamErrors,
  isErrnoException,
  VerifyCidTransform,
} from '@atproto/common'
import { BlobNotFoundError } from '@atproto/repo'
import createError, { isHttpError } from 'http-errors'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import { IncomingMessage, ServerResponse } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { pipeline, Readable } from 'node:stream'
import { Dispatcher } from 'undici'

import {
  getBlobHeaders,
  getBlobUrl,
  parseBlobParams,
  RESPONSE_HEADERS_TO_PROXY,
} from '../api/blob-resolver'
import AppContext from '../context'
import { isSuccessStatus } from '../util/http'
import log from './logger'
import { createImageUpscaler, createImageProcessor } from './sharp'
import { BadPathError, ImageUriBuilder } from './uri'
import { formatsToMimes, Options } from './util'

type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void

export function createMiddleware(
  { cfg, dataplane, blobDispatcher }: AppContext,
  { prefix = '/' }: { prefix?: string } = {},
): Middleware {
  if (!prefix.startsWith('/') && !prefix.endsWith('/')) {
    throw new TypeError('Prefix must start and end with a slash')
  }

  // If there is a CDN, we don't need to serve images
  if (cfg.cdnUrl) {
    return (req, res, next) => next()
  }

  // The "accept-encoding" header that will be used when fetching blobs from the
  // upstream PDS.
  const acceptEncoding = formatAcceptHeader(
    cfg.proxyPreferCompressed
      ? ACCEPT_ENCODING_COMPRESSED
      : ACCEPT_ENCODING_UNCOMPRESSED,
  )

  const cache = new BlobDiskCache(cfg.blobCacheLocation)

  return async (req, res, next) => {
    if (!req.url?.startsWith(prefix)) return next()

    const path = req.url
      .slice(prefix.length - 1) // keep the last slash
      .split('?', 1)[0]
    if (!path) return next()

    try {
      const options = ImageUriBuilder.getOptions(path)
      const { did, cid } = parseBlobParams(options)

      const cacheKey = [did, cid.toString(), options.preset].join('::')

      // Cached flow

      try {
        const cachedImage = await cache.get(cacheKey)
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

      const url = await getBlobUrl(dataplane, did, cid)

      const dispatcherOptions: Dispatcher.RequestOptions = {
        method: 'GET',
        origin: url.origin,
        path: url.pathname,
        headers: [
          ...getBlobHeaders(cfg, url),
          ['accept-encoding', acceptEncoding],
        ],
      }

      await blobDispatcher.stream(dispatcherOptions, (upstream) => {
        if (!isSuccessStatus(upstream.statusCode)) {
          // Throwing here would cause the upstream connection to be destroyed.
          // Killing the connection would actually fine if the payload is large,
          // which is unlikely to be the case for error responses. Destroying
          // the stream is also fine if the underlying connection is an HTTP/2
          // stream (which we can't know here?). Since we can't know for sure
          // that closing the connection is actually fine, we'll just proxy the
          // upstream error.

          res.statusCode =
            upstream.statusCode >= 500 ? 502 : upstream.statusCode

          for (const name of RESPONSE_HEADERS_TO_PROXY) {
            const val = upstream.headers[name]
            if (val) res.setHeader(name, val)
          }

          if (upstream.statusCode >= 500) {
            log.warn(
              { host: url.host, path: url.pathname },
              'blob resolution failed upstream',
            )
          }

          return res
        }

        // If the upstream data is definitely not an image, there is no need
        // to even try to process it.
        if (isImageMime(upstream.headers['content-type']) === false) {
          throw createError(400, 'Not an image')
        }

        // Let's decode, verify, process and respond

        const decoders = createDecoders(upstream.headers['content-encoding'])
        const verifier = new VerifyCidTransform(cid)
        const upscaler = createImageUpscaler(options)
        const processor = createImageProcessor(options)

        // Cache in the background
        cache
          .put(cacheKey, cloneStream(processor))
          .catch((err) => log.error(err, 'failed to cache image'))

        processor.once('info', (info) => {
          // @NOTE sharp does emit this in time to be set as a header
          res.setHeader('content-length', info.size)
        })
        res.statusCode = 200
        res.setHeader('x-cache', 'miss')
        res.setHeader('content-type', getMime(options.format))
        res.setHeader('cache-control', `public, max-age=31536000`) // 1 year

        const streams = [...decoders, verifier, upscaler, processor, res]
        pipeline(streams) // Errors will be propagated through the stream

        // Return the stream in which the upstream response will be written to
        return streams[0]
      })
    } catch (err) {
      if (res.headersSent) {
        // Most likely a pipeline error. Can be due to any of the following:
        // - The client disconnected
        // - The upstream disconnected
        // - The decoding of the stream failed
        // - The CID verification failed
        // - The processing stream failed (e.g. sharp)
        log.error(err, 'failed to serve image')
        res.destroy()
        return
      }

      if (!isHttpError(err) || err.status >= 500) {
        log.error(err, 'failed to serve image')
      }

      const error = asHttpError(err)
      const message = error.expose ? error.message : 'Internal Server Error'

      res.statusCode = error.status
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ message }))
    }
  }
}

function asHttpError(err: unknown): createError.HttpError {
  if (isHttpError(err)) return err
  if (err instanceof BadPathError) return createError(400, err)
  if (err instanceof Error) return createError(500, err)
  return createError(500)
}

function isImageMime(
  contentType: string | string[] | undefined,
): undefined | boolean {
  if (contentType == null || contentType === 'application/octet-stream') {
    return undefined // maybe
  }
  if (Array.isArray(contentType)) {
    if (contentType.length === 0) return undefined // should never happen
    if (contentType.length === 1) return isImageMime(contentType[0])
    return contentType.every(isImageMime) // Should we throw a 502 here?
  }
  return contentType.startsWith('image/')
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
    this.tempDir = basePath || path.join(os.tmpdir(), 'bsky--processed-images')
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
      if (size === 0) {
        throw new BlobNotFoundError()
      }
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

  async clear(fileId: string) {
    const filename = path.join(this.tempDir, fileId)
    await fs.rm(filename, { force: true })
  }

  async clearAll() {
    await fs.rm(this.tempDir, { recursive: true, force: true })
  }
}
