import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  Duplex,
  type DuplexOptions,
  PassThrough,
  type Readable,
  Transform,
  type TransformCallback,
  type TransformOptions,
  type Writable,
} from 'node:stream'
import { pipeline } from 'node:stream/promises'
import createError, { isHttpError } from 'http-errors'
import {
  VerifyCidError,
  VerifyCidTransform,
  createDecoders,
  isErrnoException,
} from '@atproto/common'
import { BlobNotFoundError } from '@atproto/repo'
import { type StreamBlobOptions, streamBlob } from '../api/blob-resolver.js'
import type { AppContext } from '../context.js'
import { type Middleware, responseSignal } from '../util/http.js'
import log from './logger.js'
import { createImageProcessor, createImageUpscaler } from './sharp.js'
import { BadPathError, ImageUriBuilder } from './uri.js'
import { type Options, type SharpInfo, formatsToMimes } from './util.js'

export function createMiddleware(
  ctx: AppContext,
  { prefix = '/' }: { prefix?: string } = {},
): Middleware {
  if (!prefix.startsWith('/') || !prefix.endsWith('/')) {
    throw new TypeError('Prefix must start and end with a slash')
  }

  // If there is a CDN, we don't need to serve images
  if (ctx.cfg.cdnUrl) {
    return (req, res, next) => next()
  }

  const cache = new BlobDiskCache(ctx.cfg.blobCacheLocation)

  return async (req, res, next) => {
    if (res.destroyed) return
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!req.url?.startsWith(prefix)) return next()
    const { 0: path, 1: _search } = req.url.slice(prefix.length - 1).split('?')
    if (!path.startsWith('/') || path === '/') return next()

    try {
      const options = ImageUriBuilder.getOptions(path)
      const outputType = getMime(options.format)

      const cacheKey = [options.did, options.cid, options.preset].join('::')

      // Cached flow

      try {
        const cachedImage = await cache.get(cacheKey)
        res.statusCode = 200
        res.setHeader('x-cache', 'hit')
        res.setHeader('content-type', outputType)
        res.setHeader('cache-control', `public, max-age=31536000`) // 1 year
        res.setHeader('content-length', cachedImage.size)
        await pipeline(cachedImage, res)
        return
      } catch (err) {
        if (!(err instanceof BlobNotFoundError)) {
          log.error({ cacheKey, err }, 'failed to serve cached image')
        }

        if (res.headersSent || res.destroyed) {
          res.destroy()
          return // nothing we can do...
        } else {
          // Ignore and move on to non-cached flow.
          res.removeHeader('x-cache')
          res.removeHeader('content-type')
          res.removeHeader('cache-control')
          res.removeHeader('content-length')
        }
      }

      // Non-cached flow

      const streamOptions: StreamBlobOptions = {
        did: options.did,
        cid: options.cid,
        signal: responseSignal(res),
      }

      await streamBlob(
        ctx,
        streamOptions,
        (upstream, { did, cid, url }): Writable => {
          // Definitely not an image ? Let's fail right away.
          if (isImageMime(upstream.headers['content-type']) === false) {
            throw createError(400, 'Not an image')
          }

          const streams = [
            // decompress
            ...createDecoders(upstream.headers['content-encoding']),
            // verify
            new VerifyCidTransform(cid),
            // upscale
            createImageUpscaler(options),
            // format (jpeg/webp)
            createImageProcessor(options).once('info', (info) => {
              if (!res.destroyed && !res.headersSent) {
                res.setHeader('content-length', info.size)
              }
            }),
            // save to cache
            new Tee((branch) => {
              void cache.put(cacheKey, branch).catch((err: unknown) => {
                log.warn(
                  { err, did, cid: cid.toString(), pds: url.origin },
                  'failed to cache processed image',
                )
              })
            }),
            // send downstream
            res,
          ]

          res.statusCode = 200
          res.setHeader('content-type', outputType)
          res.setHeader('cache-control', `public, max-age=31536000`) // 1 year
          res.setHeader('x-cache', 'miss')

          void pipeline(streams).catch((err: unknown) => {
            log.warn(
              { err, did, cid: cid.toString(), pds: url.origin },
              'blob resolution failed during transmission',
            )
          })

          return streams[0]!
        },
      )
    } catch (err) {
      if (res.headersSent || res.destroyed) {
        res.destroy()
      } else {
        res.removeHeader('content-type')
        res.removeHeader('content-length')
        res.removeHeader('cache-control')
        res.removeHeader('x-cache')

        if (err instanceof BadPathError) {
          next(createError(400, err))
        } else if (err instanceof VerifyCidError) {
          next(createError(404, 'Blob not found', err))
        } else if (isHttpError(err)) {
          next(err)
        } else {
          next(createError(502, 'Upstream Error', { cause: err }))
        }
      }
    }
  }
}

/**
 * A {@link Transform} that forwards every chunk downstream while mirroring a
 * copy into a "branch" {@link PassThrough} (exposed through {@link onBranch},
 * e.g. to be cached). The tee is paced by the slower of its two consumers,
 * bounding how much data gets buffered. The branch is completed when the source
 * ends, and torn down if the tee errors or is destroyed early (e.g. the client
 * disconnected).
 *
 * Consuming the branch is best-effort: its failures are swallowed here and must
 * never break the main stream.
 */
class Tee extends Transform {
  readonly #branch: PassThrough

  constructor(onBranch: (branch: Readable) => void, options?: DuplexOptions) {
    super(options)
    this.#branch = new PassThrough({ ...options, autoDestroy: true })
    // A failing branch (e.g. a cache write error) must never crash the tee.
    this.#branch.on('error', () => {})
    onBranch(this.#branch)
  }

  _transform(chunk: unknown, _enc: BufferEncoding, cb: TransformCallback) {
    // Forward downstream — cb(null, chunk) honors the response's own
    // backpressure — while mirroring to the branch. If the branch falls behind,
    // wait for it before pulling the next chunk so the tee is paced by the
    // slower of the two consumers.
    if (!this.#branch.writable || this.#branch.write(chunk)) {
      cb(null, chunk)
    } else {
      const done = () => {
        this.#branch.off('drain', done)
        this.#branch.off('close', done)
        cb(null, chunk)
      }
      this.#branch.once('drain', done)
      this.#branch.once('close', done)
    }
  }

  _flush(cb: TransformCallback) {
    // Source fully consumed: flush and close the branch.
    this.#branch.end()
    cb()
  }

  _destroy(err: Error | null, cb: (err?: Error | null) => void) {
    // Errored, or destroyed before the source finished (e.g. the client
    // disconnected): tear the (incomplete) branch down so its consumer rejects
    // instead of caching a partial blob.
    if (this.#branch.writable) this.#branch.destroy(err ?? undefined)
    cb(err)
  }
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
  const mime = formatsToMimes.get(format)
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
