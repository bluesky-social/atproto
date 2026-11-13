import { createHash, timingSafeEqual } from 'node:crypto'
import { type Duplex, Transform, type Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import createError, { isHttpError } from 'http-errors'
import type { Dispatcher } from 'undici'
import {
  VerifyCidError,
  VerifyCidTransform,
  createDecoders,
} from '@atproto/common'
import { type AtprotoDid, isAtprotoDid } from '@atproto/did'
import type { Cid } from '@atproto/lex-data'
import {
  ACCEPT_ENCODING_COMPRESSED,
  ACCEPT_ENCODING_UNCOMPRESSED,
  buildProxiedContentEncoding,
  formatAcceptHeader,
} from '@atproto-labs/xrpc-utils'
import type { ServerConfig } from '../config.js'
import type { AppContext } from '../context.js'
import {
  Code,
  getServiceEndpoint,
  isDataplaneError,
  unpackIdentityServices,
} from '../data-plane/index.js'
import { parseCid } from '../hydration/util.js'
import { httpLogger as log, recordBlobUpstreamDuration } from '../logger.js'
import {
  type Middleware,
  proxyResponseHeaders,
  responseSignal,
} from '../util/http.js'
import { BSKY_USER_AGENT } from './util.js'

export function createMiddleware(ctx: AppContext): Middleware {
  // @TODO this should be from configuration
  const maxSize = 100 * 1024 * 1024 // 100 MB
  const sourceToken = ctx.cfg.blobSourceHandoffToken
  const expectedToken =
    sourceToken && createHash('sha256').update(sourceToken).digest()
  const isSourceAuthorized = (value: string | string[] | undefined) =>
    !!expectedToken &&
    typeof value === 'string' &&
    value.startsWith('Bearer ') &&
    timingSafeEqual(
      expectedToken,
      createHash('sha256').update(value.slice('Bearer '.length)).digest(),
    )

  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const requestUrl = req.url
    if (!requestUrl) return next()
    const isSourceRequest = requestUrl.startsWith('/blob-source/')
    if (!isSourceRequest && !requestUrl.startsWith('/blob/')) return next()
    if (isSourceRequest) {
      if (!expectedToken) return next()
      if (!isSourceAuthorized(req.headers.authorization)) {
        return next(createError(401, 'Unauthorized'))
      }
    }

    const requestPath = isSourceRequest
      ? requestUrl.split('?', 1)[0]!
      : requestUrl
    const { length, 2: didParam, 3: cidParam } = requestPath.split('/')
    if (length !== 4 || !didParam || !cidParam) return next()

    // @TODO Check sec-fetch-* headers (e.g. to prevent files from being
    // displayed as a web page) ?

    try {
      if (isSourceRequest) {
        const source = await resolveBlobSource(ctx, didParam, cidParam)
        const body = source.takenDown
          ? { takenDown: true }
          : { takenDown: false, origin: source.origin }
        res.statusCode = 200
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.setHeader('x-content-type-options', 'nosniff')
        res.end(JSON.stringify(body))
        return
      }

      let upstreamStartedAt = 0
      let upstreamFinished = false
      const onUpstreamClose = () => {
        if (!upstreamFinished) {
          recordBlobUpstreamDuration(res, performance.now() - upstreamStartedAt)
        }
      }
      const streamOptions: StreamBlobOptions = {
        did: didParam,
        cid: cidParam,
        signal: responseSignal(res),
        onUpstreamStart: (startedAt) => {
          upstreamStartedAt = startedAt
          res.prependOnceListener('close', onUpstreamClose)
        },
        onUpstreamFinish: (durationMs) => {
          upstreamFinished = true
          res.off('close', onUpstreamClose)
          recordBlobUpstreamDuration(res, durationMs)
        },
        // Because we will be verifying the CID, we need to ensure that the
        // upstream response can be de-compressed. We do this by negotiating the
        // "accept-encoding" header based on the downstream client's capabilities.
        acceptEncoding: buildProxiedContentEncoding(
          req.headers['accept-encoding'],
          ctx.cfg.proxyPreferCompressed,
        ),
      }

      await streamBlob(ctx, streamOptions, (upstream, { cid, did, url }) => {
        const encoding = upstream.headers['content-encoding']
        const verifier = createCidVerifier(cid, encoding, maxSize)

        const logError = (err: unknown) => {
          log.warn(
            { err, did, cid: cid.toString(), pds: url.origin },
            'blob resolution failed during transmission',
          )
        }

        const onError = (err: unknown) => {
          // No need to pipe the data (verifier) into the response, as it is
          // "errored". The response processing will continue in the "catch"
          // block below (because streamBlob() will reject the promise in case
          // of "error" event on the writable stream returned by the factory).
          clearTimeout(graceTimer)
          logError(err)
        }

        // Catch any error that occurs before the timer bellow is triggered.
        // The promise returned by streamBlob() will be rejected as soon as
        // the verifier errors.
        verifier.on('error', onError)

        // The way I/O work, it is likely that, in case of small payloads, the
        // full upstream response is already buffered at this point. In order to
        // return a 404 instead of a broken response stream, we allow the event
        // loop to to process any pending I/O events before we start piping the
        // bytes to the response. For larger payloads, the response will look
        // like a 200 with a broken chunked response stream. The only way around
        // that would be to buffer the entire response before piping it to the
        // response, which will hurt latency (need the full payload) and memory
        // usage (either RAM or DISK). Since this is more of an edge case, we
        // allow the broken response stream to be sent.
        const graceTimer = setTimeout(() => {
          verifier.off('error', onError)

          // Make sure that the content served from the bsky api domain cannot
          // be used to perform XSS attacks (by serving HTML pages)
          res.setHeader(
            'Content-Security-Policy',
            `default-src 'none'; sandbox`,
          )
          res.setHeader('X-Content-Type-Options', 'nosniff')
          res.setHeader('X-Frame-Options', 'DENY')
          res.setHeader('X-XSS-Protection', '0')

          // @TODO Add a cache-control header ?
          // @TODO Add content-disposition header (to force download) ?

          proxyResponseHeaders(upstream, res)

          // Force chunked encoding. This is required because the verifier will
          // trigger an error *after* the last chunk has been passed through.
          // Because the number of bytes sent will match the content-length, the
          // HTTP response will be considered "complete" by the HTTP server. At
          // this point, only trailers headers could indicate that an error
          // occurred, but that is not the behavior we expect.
          res.removeHeader('content-length')

          // From this point on, triggering the next middleware (including any
          // error handler) can be problematic because content-type,
          // content-encoding, etc. headers have already been set. Because of
          // this, we make sure that res.headersSent is set to true, preventing
          // another error handler middleware from being called (from the catch
          // block bellow). Not flushing the headers here would require to
          // revert the headers set from this middleware (which we don't do for
          // now).
          res.flushHeaders()

          // Pipe the verifier output into the HTTP response
          void pipeline([verifier, res]).catch(logError)
        }, 10) // 0 works too. Allow for additional data to come in for 10ms.

        // Write the upstream response into the verifier.
        return verifier
      })
    } catch (err) {
      if (res.headersSent || res.destroyed) {
        res.destroy()
      } else if (err instanceof VerifyCidError) {
        // @NOTE This only works because of the graceTimer above. It will also
        // only be triggered for small payloads.
        next(createError(404, err.message))
      } else if (isHttpError(err)) {
        next(err)
      } else {
        next(createError(502, 'Upstream Error', { cause: err }))
      }
    }
  }
}

export type StreamBlobOptions = {
  cid: string
  did: string
  acceptEncoding?: string
  signal?: AbortSignal
  onUpstreamStart?: (startedAt: number) => void
  onUpstreamFinish?: (durationMs: number) => void
}

export type StreamBlobFactory = (
  data: Dispatcher.StreamFactoryData,
  info: {
    url: URL
    did: AtprotoDid
    cid: Cid
  },
) => Writable

export async function streamBlob(
  ctx: AppContext,
  options: StreamBlobOptions,
  factory: StreamBlobFactory,
) {
  const source = await resolveBlobSource(ctx, options.did, options.cid)
  if (source.takenDown) throw createError(404, 'Blob not found')

  const { did, cid } = source
  const url = new URL(`/xrpc/com.atproto.sync.getBlob`, source.origin)
  url.searchParams.set('did', did)
  url.searchParams.set('cid', cid.toString())

  const headers = getBlobHeaders(ctx.cfg, url)

  headers.set(
    'accept-encoding',
    options.acceptEncoding ||
      formatAcceptHeader(
        ctx.cfg.proxyPreferCompressed
          ? ACCEPT_ENCODING_COMPRESSED
          : ACCEPT_ENCODING_UNCOMPRESSED,
      ),
  )

  let headersReceived = false
  const upstreamStartedAt = performance.now()
  options.onUpstreamStart?.(upstreamStartedAt)
  let upstreamFinishRecorded = false
  const recordUpstreamFinish = () => {
    if (upstreamFinishRecorded) return
    upstreamFinishRecorded = true
    options.onUpstreamFinish?.(performance.now() - upstreamStartedAt)
  }

  return ctx.blobDispatcher
    .stream(
      {
        method: 'GET',
        origin: url.origin,
        path: url.pathname + url.search,
        headers,
        signal: options.signal,
      },
      (upstream) => {
        headersReceived = true

        if (upstream.statusCode !== 200) {
          log.warn(
            {
              did,
              cid: cid.toString(),
              pds: url.origin,
              status: upstream.statusCode,
            },
            `blob resolution failed upstream`,
          )

          throw upstream.statusCode >= 400 && upstream.statusCode < 500
            ? createError(404, 'Blob not found', { cause: upstream }) // 4xx => 404
            : createError(502, 'Upstream Error', { cause: upstream }) // !200 && !4xx => 502
        }

        const writable = factory(upstream, { url, did, cid })
        if (options.onUpstreamFinish) {
          writable.once('prefinish', recordUpstreamFinish)
        }
        return writable
      },
    )
    .catch((err) => {
      // Is this a connection error, or a stream error ?
      if (!headersReceived) {
        // connection error, dns error, headers timeout, ...
        log.warn(
          { err, did, cid: cid.toString(), pds: url.origin },
          'blob resolution failed during connection',
        )

        throw createError(502, 'Upstream Error', { cause: err })
      }

      throw err
    })
    .finally(recordUpstreamFinish)
}

function parseBlobParams(params: { cid: string; did: string }) {
  const { cid, did } = params
  if (!isAtprotoDid(did)) throw createError(400, 'Invalid did')
  const cidObj = parseCid(cid)
  if (!cidObj) throw createError(400, 'Invalid cid')
  return { cid: cidObj, did }
}

type BlobSourceResolution = {
  did: AtprotoDid
  cid: Cid
} & ({ takenDown: true } | { takenDown: false; origin: string })

/** Resolve blob policy and its PDS without accessing the blob itself. */
export async function resolveBlobSource(
  ctx: AppContext,
  didParam: string,
  cidParam: string,
): Promise<BlobSourceResolution> {
  const { did, cid } = parseBlobParams({ did: didParam, cid: cidParam })
  const { dataplane } = ctx
  const [identity, { takenDown }] = await Promise.all([
    dataplane.getIdentityByDid({ did }).catch((err) => {
      if (isDataplaneError(err, Code.NotFound)) {
        return undefined
      }
      throw err
    }),
    dataplane.getBlobTakedown({ did, cid: cid.toString() }),
  ])

  if (takenDown) {
    return { did, cid, takenDown: true }
  }

  const services = identity && unpackIdentityServices(identity.services)
  const pds =
    services &&
    getServiceEndpoint(services, {
      id: 'atproto_pds',
      type: 'AtprotoPersonalDataServer',
    })

  if (!pds) {
    throw createError(404, 'Origin not found')
  }

  return { did, cid, takenDown: false, origin: new URL(pds).origin }
}

function getBlobHeaders(
  {
    blobRateLimitBypassKey: bypassKey,
    blobRateLimitBypassHostname: bypassHostname,
  }: ServerConfig,
  url: URL,
): Map<string, string> {
  const headers = new Map<string, string>()

  headers.set('user-agent', BSKY_USER_AGENT)

  if (bypassKey && bypassHostname) {
    const matchesUrl = bypassHostname.startsWith('.')
      ? url.hostname.endsWith(bypassHostname)
      : url.hostname === bypassHostname

    if (matchesUrl) {
      headers.set('x-ratelimit-bypass', bypassKey)
    }
  }

  return headers
}

/**
 * This function creates a passthrough stream that will decompress (if needed)
 * and verify the CID of the input stream. The output data will be identical to
 * the input data.
 *
 * If you need the un-compressed data, you should use a decompress + verify
 * pipeline instead.
 */
function createCidVerifier(
  cid: Cid,
  encoding?: string | string[],
  maxSize?: number,
): Duplex {
  // If the upstream content is compressed, we do not want to return a
  // de-compressed stream here. Indeed, the "compression" middleware will
  // compress the response before it is sent downstream, if it is not already
  // compressed. Because of this, it is preferable to return the content as-is
  // to avoid re-compressing it.
  //
  // We do still want to be able to verify the CID, which requires decompressing
  // the input bytes.
  //
  // To that end, we create a passthrough in order to "tee" the stream into two
  // streams: one that will be sent, unaltered, downstream, and a pipeline that
  // will be used to decompress & verify the CID (discarding de-compressed
  // data).

  const decoders = createDecoders(encoding, {
    maxSize,
    maxSizeError: () => createError(400, 'Blob too large'),
  })
  const verifier = new VerifyCidTransform(cid)

  const pipelineController = new AbortController()
  const pipelineStreams: Duplex[] = [...decoders, verifier]
  const pipelineInput = pipelineStreams[0]!

  // Create a promise that will resolve if, and only if, the decoding and
  // verification succeed.
  const pipelinePromise: Promise<null | Error> = pipeline(pipelineStreams, {
    signal: pipelineController.signal,
  }).then(
    () => null,
    (err) => {
      const error = asError(err)

      // the data being processed by the pipeline is invalid (e.g. invalid
      // compressed content, non-matching the CID, ...). If that occurs, we can
      // destroy the passthrough (this allows not to wait for the "flush" event
      // to propagate the error).
      passthrough.destroy(error)

      return error
    },
  )

  // We don't care about the (un-compressed) data, we only use the verifier to
  // detect any error through the pipelinePromise. We still need to pass the
  // verifier into flowing mode to ensure that the pipelinePromise resolves.
  verifier.resume()

  const passthrough = new Transform({
    transform(chunk, encoding, callback) {
      pipelineInput.write(chunk, encoding)
      callback(null, chunk)
    },
    flush(callback) {
      // End the input stream, which will resolve the pipeline promise
      pipelineInput.end()
      // End the pass-through stream according to the result of the pipeline
      pipelinePromise.then(callback)
    },
    destroy(err, callback) {
      pipelineController.abort() // Causes pipeline() to destroy all streams
      callback(err)
    },
  })

  return passthrough
}

function asError(err: unknown): Error {
  return err instanceof Error
    ? err
    : new Error('Processing failed', { cause: err })
}
