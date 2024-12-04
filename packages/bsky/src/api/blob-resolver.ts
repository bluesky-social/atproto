import { buildProxiedContentEncoding } from '@atproto-labs/xrpc-utils'
import { createDecoders, VerifyCidTransform } from '@atproto/common'
import { isAtprotoDid } from '@atproto/did'
import createError, { isHttpError } from 'http-errors'
import { CID } from 'multiformats/cid'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Duplex, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
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
import { isSuccessStatus } from '../util/http'

export const RESPONSE_HEADERS_TO_PROXY = [
  'content-type',
  'content-length',
  'content-encoding',
  'content-language',
  'cache-control',
  'last-modified',
  'etag',
  'expires',
  'retry-after',
  'vary', // Might vary based on "accept" headers
] as const

export function createMiddleware(ctx: AppContext) {
  const { cfg, dataplane, blobDispatcher } = ctx

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!req.url?.startsWith('/blob/')) return next()
    const { length, 2: didParam, 3: cidParam } = req.url.split('/')
    if (length !== 4 || !cidParam || !cidParam) return next()

    try {
      const { did, cid } = parseBlobParams({ cid: cidParam, did: didParam })
      const url = await getBlobUrl(dataplane, did, cid)

      // Security headers
      res.setHeader('Content-Security-Policy', `default-src 'none'; sandbox`)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-Frame-Options', 'DENY')
      res.setHeader('X-XSS-Protection', '0')

      // Because we will be verifying the CID, we need to ensure that the
      // upstream response can be de-compressed. We do this by negotiating the
      // "accept-encoding" header based on the downstream client's capabilities.
      const acceptEncoding = buildProxiedContentEncoding(
        req.headers['accept-encoding'],
        cfg.proxyPreferCompressed,
      )

      const options: Dispatcher.RequestOptions = {
        method: 'GET',
        origin: url.origin,
        path: url.pathname + url.search,
        headers: Object.fromEntries([
          ...getBlobHeaders(cfg, url),
          ['accept-encoding', acceptEncoding],
        ]),
      }

      await blobDispatcher
        .stream(options, (upstream) => {
          // Proxy status code
          res.statusCode = upstream.statusCode

          // Proxy headers
          for (const name of RESPONSE_HEADERS_TO_PROXY) {
            const val = upstream.headers[name]
            if (val) res.setHeader(name, val)
          }

          if (!isSuccessStatus(upstream.statusCode)) {
            if (upstream.statusCode >= 500) {
              res.statusCode = 502
              log.warn(
                { host: url.host, path: url.pathname },
                'blob resolution failed upstream',
              )
            }

            // We avoid throwing here to avoid destroying the upstream HTTP
            // connection (this would be fine if the connection was HTTP/2, but
            // we can't know that).
            return res
          }

          // 2xx status code, let's verify the CID

          const encoding = upstream.headers['content-encoding']
          const duplex = createCidVerifier(cid, encoding)

          // Pipe the readable side of the duplex to the client response
          // stream. This will ensure proper flow control and backpressure.
          void pipeline([duplex, res]).catch((err) => {
            log.warn(
              { err, did, cid: cid.toString(), pds: url.origin },
              'blob resolution failed during transmission',
            )
          })

          // Return the duplex as the writable side of the stream that will be
          // used by undici to receive the upstream response.
          return duplex
        })
        .catch((err) => {
          if (!isHttpError(err)) {
            log.warn(
              { err, did, cid: cid.toString(), pds: url.origin },
              'blob resolution failed during transmission',
            )
            throw createError(502)
          }

          throw err
        })
    } catch (err) {
      if (res.headersSent) {
        res.destroy()
      } else {
        next(err || createError(500))
      }
    }
  }
}

export function parseBlobParams(params: { cid: string; did: string }) {
  const { cid, did } = params
  if (!isAtprotoDid(did)) throw createError(400, 'Invalid did')
  const cidObj = parseCid(cid)
  if (!cidObj) throw createError(400, 'Invalid cid')
  return { cid: cidObj, did }
}

export async function getBlobUrl(
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

export async function getBlobPds(
  dataplane: DataPlaneClient,
  did: string,
  cid: CID,
): Promise<string> {
  const cidStr = cid.toString()

  const abortController = new AbortController()
  const { signal } = abortController

  // Start both promises in parallel, but don't use Promise.all as we don't care
  // about the identity result if the blob was takendown, and we want to return
  // (or throw) ASAP.
  const takendownPromise = dataplane.getBlobTakedown({ did, cid: cidStr })
  const identityPromise = dataplane.getIdentityByDid({ did }, { signal })

  // Avoid "uncaught promise rejection" error (we will await later, if we care)
  identityPromise.catch(() => {})

  const { takenDown } = await takendownPromise
  // If the blob is taken down, don't wait for the identity promise
  if (takenDown) {
    abortController.abort() // We don't care about the identity response
    throw createError(404, 'Blob not found')
  }

  return identityPromise.then(
    (identity) => {
      const services = unpackIdentityServices(identity.services)
      const pds = getServiceEndpoint(services, {
        id: 'atproto_pds',
        type: 'AtprotoPersonalDataServer',
      })

      if (!pds) {
        throw createError(404, 'Origin not found')
      }

      return pds
    },
    (err) => {
      if (isDataplaneError(err, Code.NotFound)) {
        throw createError(404, 'Origin not found')
      }
      throw err
    },
  )
}

export function* getBlobHeaders(
  {
    blobRateLimitBypassKey: bypassKey,
    blobRateLimitBypassHostname: bypassHostname,
  }: ServerConfig,
  url: URL,
): Generator<[string, string], void, unknown> {
  if (bypassKey && bypassHostname) {
    const matchesUrl = bypassHostname.startsWith('.')
      ? url.hostname.endsWith(bypassHostname)
      : url.hostname === bypassHostname

    if (matchesUrl) {
      yield ['x-ratelimit-bypass', bypassKey]
    }
  }
}

/**
 * This function creates a passthrough stream that will decompress (if needed)
 * and verify the CID of the input stream. The output data will be identical to
 * the input data. For that reason, iy you need the
 */
export function createCidVerifier(
  cid: CID,
  encoding?: string | string[],
): Duplex {
  // If the upstream content is compressed, we do not want to return a
  // de-compressed stream here. Indeed, the "compression" middleware will
  // compress the response before it is sent downstream, if it is not already
  // compressed. Because of this, it is preferable to keep the return the
  // content as-is to avoid re-compressing it.
  //
  // We do still want to be able to verify the CID, which requires decompressing
  // the input bytes.
  //
  // To that end, we create a duplex that will "tee" the stream into two
  // streams: one that will be sent, unaltered, downstream, and another that
  // will be used to verify the CID (without using the data).

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
    const error = err instanceof Error ? err : new Error('Processing failed')

    // the data being processed by the pipeline is invalid (e.g. invalid
    // compressed content, non-matching the CID, ...). If that occurs, we can
    // destroy the passthrough (this allows not to wait for the "flush" event
    // to propagate the error).
    passthrough.destroy(error)

    throw error
  })

  // Avoid unhandled promise rejection (we will handle it later)
  pipelinePromise.catch((_err) => {})

  // We don't care about the un-compressed data, we only use the verifier to
  // detect any error through the pipelinePromise. We still need to pass the
  // verifier in "resume" mode to ensure that the pipelinePromise resolves.
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
      pipelinePromise.then(() => callback(), callback)
    },
    destroy(err, callback) {
      pipelineInput.destroy() // Might be redundant with next line. That's fine.
      pipelineController.abort()
      callback(err)
    },
  })

  return passthrough
}
