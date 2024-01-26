import { pipeline, Readable } from 'stream'
import express from 'express'
import createError from 'http-errors'
import axios, { AxiosError } from 'axios'
import { CID } from 'multiformats/cid'
import { ensureValidDid } from '@atproto/syntax'
import { forwardStreamErrors, VerifyCidTransform } from '@atproto/common'
import { DidNotFoundError } from '@atproto/identity'
import AppContext from '../context'
import { httpLogger as log } from '../logger'
import { retryHttp } from '../util/retry'
import {
  Code,
  getServiceEndpoint,
  isDataplaneError,
  unpackIdentityServices,
} from '../data-plane'

// Resolve and verify blob from its origin host

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  router.get('/blob/:did/:cid', async function (req, res, next) {
    try {
      const { did, cid: cidStr } = req.params
      try {
        ensureValidDid(did)
      } catch (err) {
        return next(createError(400, 'Invalid did'))
      }
      let cid: CID
      try {
        cid = CID.parse(cidStr)
      } catch (err) {
        return next(createError(400, 'Invalid cid'))
      }

      const verifiedImage = await resolveBlob(ctx, did, cid)

      // Send chunked response, destroying stream early (before
      // closing chunk) if the bytes don't match the expected cid.
      res.statusCode = 200
      res.setHeader('content-type', verifiedImage.contentType)
      res.setHeader('x-content-type-options', 'nosniff')
      res.setHeader('content-security-policy', `default-src 'none'; sandbox`)
      pipeline(verifiedImage.stream, res, (err) => {
        if (err) {
          log.warn(
            { err, did, cid: cidStr, pds: verifiedImage.pds },
            'blob resolution failed during transmission',
          )
        }
      })
    } catch (err) {
      if (err instanceof AxiosError) {
        if (err.code === AxiosError.ETIMEDOUT) {
          log.warn(
            { host: err.request?.host, path: err.request?.path },
            'blob resolution timeout',
          )
          return next(createError(504)) // Gateway timeout
        }
        if (!err.response || err.response.status >= 500) {
          log.warn(
            { host: err.request?.host, path: err.request?.path },
            'blob resolution failed upstream',
          )
          return next(createError(502))
        }
        return next(createError(404, 'Blob not found'))
      }
      if (err instanceof DidNotFoundError) {
        return next(createError(404, 'Blob not found'))
      }
      return next(err)
    }
  })

  return router
}

export async function resolveBlob(ctx: AppContext, did: string, cid: CID) {
  const cidStr = cid.toString()

  const [identity, { takenDown }] = await Promise.all([
    ctx.dataplane.getIdentityByDid({ did }).catch((err) => {
      if (isDataplaneError(err, Code.NotFound)) {
        return undefined
      }
      throw err
    }),
    ctx.dataplane.getBlobTakedown({ did, cid: cid.toString() }),
  ])
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
  if (takenDown) {
    throw createError(404, 'Blob not found')
  }

  const blobResult = await retryHttp(() => getBlob({ pds, did, cid: cidStr }))
  const imageStream: Readable = blobResult.data
  const verifyCid = new VerifyCidTransform(cid)

  forwardStreamErrors(imageStream, verifyCid)
  return {
    pds,
    contentType:
      blobResult.headers['content-type'] || 'application/octet-stream',
    stream: imageStream.pipe(verifyCid),
  }
}

async function getBlob(opts: { pds: string; did: string; cid: string }) {
  const { pds, did, cid } = opts
  return axios.get(`${pds}/xrpc/com.atproto.sync.getBlob`, {
    params: { did, cid },
    decompress: true,
    responseType: 'stream',
    timeout: 5000, // 5sec of inactivity on the connection
  })
}
