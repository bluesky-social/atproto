import crypto from 'node:crypto'
import qs from 'node:querystring'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceStatePayload } from '../../../../lexicon/types/app/bsky/unspecced/defs'

import { KWS_SIGNING_KEY } from './env'

type StatusPayload = {
  verified: true
  transactionId: string
  errorCode: string | null
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.handleAgeAssuranceComplete({
    handler: async ({ auth, params }) => {
      const { status: rawStatusPayload, externalPayload, signature } = params

      console.log('handleAgeAssuranceComplete', params)

      try {
        if (rawStatusPayload && externalPayload && signature) {
          const expectedSignature = crypto
            .createHmac('sha256', KWS_SIGNING_KEY)
            .update(`${rawStatusPayload}:${externalPayload}`)
            .digest('hex')
          const expectedBuffer = Buffer.from(expectedSignature, 'hex')
          const signedBuffer = Buffer.from(signature, 'hex')

          if (expectedBuffer.length !== signedBuffer.length) {
            throw new Error(`Signature mismatch`)
          }

          if (!crypto.timingSafeEqual(expectedBuffer, signedBuffer)) {
            throw new Error(`Signature mismatch`)
          }

          const statusPayload = JSON.parse(rawStatusPayload) as StatusPayload
          const status = getResponseStatus(statusPayload)
          // TODO abstract this
          const { actorDid, attemptId } = JSON.parse(externalPayload) as {
            actorDid: string
            attemptId: string
          }

          if (!actorDid) {
            throw new Error('Missing DID in externalPayload')
          }
          if (!attemptId) {
            throw new Error('Missing DID in externalPayload')
          }

          const NSID = 'app.bsky.unspecced.defs#ageAssuranceState'
          const payload: AgeAssuranceStatePayload = {
            timestamp: new Date().toISOString(),
            source: 'user',
            status,
            attemptId,
          }

          // TODO store this
          console.log('write', {
            NSID,
            payload,
          })

          return {
            encoding: 'application/json',
            statusCode: 302,
            headers: {
              Location: `https://bsky.app/intent/age-assurance?${qs.stringify({ status })}`,
            },
            body: {
              status,
            },
          }
        } else {
          throw new Error(`Unexpected payload`)
        }
      } catch (e) {
        console.error(e) // TODO
        return {
          encoding: 'application/json',
          statusCode: 302,
          headers: {
            Location: `https://bsky.app/intent/age-assurance?${qs.stringify({ status: 'failed' })}`,
          },
          body: {
            status: 'failed',
          },
        }
      }
    },
  })
}

// TODO abstract this
function getResponseStatus(
  statusPayload: StatusPayload,
): AgeAssuranceStatePayload['status'] {
  if (statusPayload.verified) {
    return 'assured'
  } else if (statusPayload.errorCode) {
    return 'failed'
  } else {
    return 'unknown'
  }
}
