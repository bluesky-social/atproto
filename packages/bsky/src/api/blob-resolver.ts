import {
  ACCEPT_ENCODING_COMPRESSED,
  ACCEPT_ENCODING_UNCOMPRESSED,
  buildProxiedContentEncoding,
  formatAcceptHeader,
} from '@atproto-labs/xrpc-utils'
import {
  createDecoders,
  VerifyCidError,
  VerifyCidTransform,
} from '@atproto/common'
import { AtprotoDid, isAtprotoDid } from '@atproto/did'
import createError, { isHttpError } from 'http-errors'
import { CID } from 'multiformats/cid'
import { Duplex, Transform, Writable } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'
import { Dispatcher } from 'undici'

import { ServerConfig } from '../config'
import AppContext from '../context'
import {
  Code,
  DataPlaneClient,
  getServiceEndpoint,
  isDataplaneError,
  unpackIdentityServices,
} from '../data-plane'
import { parseCid } from '../hydration/util'
import { httpLogger as log } from '../logger'
import { Middleware, proxyResponseHeaders, responseSignal } from '../util/http'

export function createMiddleware(ctx: AppContext): Middleware {
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!req.url?.startsWith('/blob/')) return next()
    const { length, 2: didParam, 3: cidParam } = req.url.split('/')
    if (length !== 4 || !didParam || !cidParam) return next()

    try {
      res.setHeader('Content-Security-Policy', `default-src 'none'; sandbox`)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-Frame-Options', 'DENY')
      res.setHeader('X-XSS-Protection', '0')

      const streamOptions: StreamBlobOptions = {
        did: didParam,
        cid: cidParam,
        signal: responseSignal(res),
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
        const verifier = createCidVerifier(cid, encoding)

        const onError = (err: unknown) => {
          log.warn(
            { err, did, cid: cid.toString(), pds: url.origin },
            'blob resolution failed during transmission',
          )
        }

        if (req.method === 'HEAD') {
          // Abort the verification if the client closes the connection
          res.once('close', () => verifier.destroy())
          // Use the verifier result to end the response
          void finished(verifier.resume()).then(() => {
            // Verifier succeeded, write the head
            proxyResponseHeaders(upstream, res)
            res.end()
          }, onError)
        } else {
          // Pipe the verifier output into the HTTP response
          void pipeline([verifier, res]).catch(onError)
          proxyResponseHeaders(upstream, res)
        }

        // Write the upstream response into the verifier.
        return verifier
      })
    } catch (err) {
      if (res.headersSent || res.destroyed) {
        res.destroy()
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

export type StreamBlobOptions = {
  cid: string
  did: string
  acceptEncoding?: string
  signal?: AbortSignal
}

export type StreamBlobFactory = (
  data: Dispatcher.StreamFactoryData,
  info: {
    url: URL
    did: AtprotoDid
    cid: CID
  },
) => Writable

export async function streamBlob(
  ctx: AppContext,
  options: StreamBlobOptions,
  factory: StreamBlobFactory,
) {
  const { did, cid } = parseBlobParams(options)
  const url = await getBlobUrl(ctx.dataplane, did, cid)

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

  return ctx.blobDispatcher.stream(
    {
      method: 'GET',
      origin: url.origin,
      path: url.pathname + url.search,
      headers,
      signal: options.signal,
    },
    (upstream) => {
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

        const error =
          upstream.statusCode >= 400 && upstream.statusCode < 500
            ? createError(404, 'Blob not found') // 4xx => 404
            : createError(502, 'Upstream Error') // 1xx, 3xx, 5xx => 502

        // Throwing here will kill the underlying stream. This is fine if the
        // payload is large (we'd rather pay the overhead of establishing a new
        // connection than consume all that bandwidth), or if the underlying
        // stream is using HTTP/2 (which we can't know here, or can we?). In
        // an attempt to keep the connection alive, we will drain the first
        // MAX_SIZE bytes of the response before causing an error.

        const MAX_SIZE = 256 * 1024 // 256 KB

        // Abort the response right away if the content-length is too large
        const length = upstream.headers['content-length']
        if (typeof length === 'string' && !(parseInt(length, 10) < MAX_SIZE)) {
          throw error
        }

        // Create a writable that will drain the upstream response and cause
        // an error when the response ends, causing the returned promise to
        // reject.
        return Duplex.from(async function (data: AsyncIterable<Uint8Array>) {
          // Let's drain the first MAX_SIZE bytes of the response in an attempt
          // to keep the connection alive.
          let size = 0
          for await (const chunk of data) {
            size += Buffer.byteLength(chunk)
            // Stop the processing (destroying the connection) if the response
            // is too large.
            if (size > MAX_SIZE) throw error
          }
          // At this point the upstream response has successfully "ended",
          // meaning that throwing shouldn't destroy the underlying connection.
          // Throwing should only cause the promise to reject.
          throw error
        })
      }

      return factory(upstream, { url, did, cid })
    },
  )
}

function parseBlobParams(params: { cid: string; did: string }) {
  const { cid, did } = params
  if (!isAtprotoDid(did)) throw createError(400, 'Invalid did')
  const cidObj = parseCid(cid)
  if (!cidObj) throw createError(400, 'Invalid cid')
  return { cid: cidObj, did }
}

async function getBlobUrl(
  dataplane: DataPlaneClient,
  did: string,
  cid: CID,
): Promise<URL> {
  const pds = await getBlobPds(dataplane, did, cid)

  const url = new URL(`/xrpc/com.atproto.sync.getBlob`, pds)
  url.searchParams.set('did', did)
  url.searchParams.set('cid', cid.toString())

  return url
}

async function getBlobPds(
  dataplane: DataPlaneClient,
  did: string,
  cid: CID,
): Promise<string> {
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
    throw createError(404, 'Blob not found')
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

  return pds
}

function getBlobHeaders(
  {
    blobRateLimitBypassKey: bypassKey,
    blobRateLimitBypassHostname: bypassHostname,
  }: ServerConfig,
  url: URL,
): Map<string, string> {
  const headers = new Map<string, string>()

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
function createCidVerifier(cid: CID, encoding?: string | string[]): Duplex {
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

  const decoders = createDecoders(encoding)
  const verifier = new VerifyCidTransform(cid)

  // Optimization: If the content is not compressed, we don't need to "tee" the
  // stream, we can use the verifier as simple passthrough.
  if (!decoders.length) return verifier

  const pipelineController = new AbortController()

  // Create a promise that will resolve if, and only if, the decoding and
  // verification succeed.
  const pipelinePromise = pipeline([...decoders, verifier], {
    signal: pipelineController.signal,
  }).catch((err) => {
    const error = asError(err)

    // the data being processed by the pipeline is invalid (e.g. invalid
    // compressed content, non-matching the CID, ...). If that occurs, we can
    // destroy the passthrough (this allows not to wait for the "flush" event
    // to propagate the error).
    passthrough.destroy(error)

    throw error
  })

  // Avoid unhandled promise rejection (we will handle them later)
  pipelinePromise.catch((_err) => {})

  // We don't care about the un-compressed data, we only use the verifier to
  // detect any error through the pipelinePromise. We still need to pass the
  // verifier into flowing mode to ensure that the pipelinePromise resolves.
  verifier.resume()

  const pipelineInput = decoders[0]

  const passthrough = new Transform({
    transform(chunk, _encoding, callback) {
      pipelineInput.write(chunk)
      callback(null, chunk)
    },
    flush(callback) {
      // End the input stream, which will resolve the pipeline promise
      pipelineInput.end()
      // End the pass-through stream according to the result of the pipeline
      pipelinePromise.then(
        () => callback(),
        (err: unknown) => callback(asError(err)),
      )
    },
    destroy(err, callback) {
      pipelineController.abort() // Causes pipeline() to destroy all streams
      callback(err)
    },
  })

  return passthrough
}

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error('Processing failed')
}
