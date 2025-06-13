import crypto from 'node:crypto'
import qs from 'node:querystring'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeVerificationState } from '../../../../lexicon/types/app/bsky/verification/defs'

import { VERIFICATION_SECRET } from './env'

type StatusPayload = {
  verified: true
  transactionId: string
  errorCode: string | null
}

export default function (server: Server, _ctx: AppContext) {
  server.app.bsky.verification.handleAgeVerificationComplete({
    handler: async ({ params }) => {
      const { status: rawStatusPayload, externalPayload, signature } = params

      console.log('handleAgeVerificationComplete', params)

      try {
        if (rawStatusPayload && externalPayload && signature) {
          const expectedSignature = crypto
            .createHmac('sha256', VERIFICATION_SECRET)
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

          // TODO save
          // TODO handle save failures

          return {
            encoding: 'application/json',
            statusCode: 302,
            headers: {
              Location: `https://bsky.app/intent/age-verification?${qs.stringify({ status })}`,
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
            Location: `https://bsky.app/intent/age-verification?${qs.stringify({ status: 'failed' })}`,
          },
          body: {
            status: 'failed',
          },
        }
      }
    },
  })
}

function getResponseStatus(
  statusPayload: StatusPayload,
): AgeVerificationState['status'] {
  if (statusPayload.verified) {
    return 'verified-adult'
  } else if (statusPayload.errorCode) {
    return 'failed'
  } else {
    return 'unverified' // TODO unverified-minor?
  }
}
