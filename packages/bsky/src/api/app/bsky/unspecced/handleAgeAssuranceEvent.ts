import crypto from 'node:crypto'

import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceStatePayload } from '../../../../lexicon/types/app/bsky/unspecced/defs'
import { Payload } from '../../../../lexicon/types/app/bsky/unspecced/handleAgeAssuranceEvent'

import { KWS_WEBHOOK_SIGNING_KEY } from './env'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.handleAgeAssuranceEvent({
    handler: async ({ req, input }) => {
      try {
        const rawSignatureHeader = req.headers['x-kws-signature']

        if (!rawSignatureHeader) {
          throw new Error('Missing signature header')
        }

        const signatureHeader = Array.isArray(rawSignatureHeader)
          ? rawSignatureHeader.join(',')
          : rawSignatureHeader

        console.log('handleAgeAssuranceEvent', {
          rawSignatureHeader,
          input: JSON.stringify(input),
        })

        const [t, v1] = signatureHeader.split(',')
        const timestamp = t?.split('=')[1]
        const signature = v1?.split('=')[1]

        if (typeof timestamp !== 'string' || typeof signature !== 'string') {
          throw new Error('Invalid signature header format')
        }

        const expectedSignature = crypto
          .createHmac('sha256', KWS_WEBHOOK_SIGNING_KEY)
          // TODO should use the raw body
          .update(`${timestamp}.${JSON.stringify(req.body)}`)
          .digest('hex')
        const expectedBuffer = Buffer.from(expectedSignature, 'hex')
        const signedBuffer = Buffer.from(signature, 'hex')

        if (expectedBuffer.length !== signedBuffer.length) {
          throw new Error(`Signature mismatch`)
        }

        if (!crypto.timingSafeEqual(expectedBuffer, signedBuffer)) {
          throw new Error(`Signature mismatch`)
        }

        if (!input.body.payload) {
          throw new Error('Missing payload in input body')
        }
        if (!input.body.payload.status) {
          throw new Error('Missing status in input body payload')
        }
        if (!input.body.payload.externalPayload) {
          throw new Error('Missing externalPayload in input body payload')
        }

        // TODO abstract this
        const { actorDid, attemptId } = JSON.parse(
          input.body.payload.externalPayload,
        ) as {
          actorDid: string
          attemptId: string
        }

        if (!actorDid) {
          throw new Error('Missing DID in externalPayload')
        }
        if (!attemptId) {
          throw new Error('Missing DID in externalPayload')
        }

        const status = getResponseStatus(input.body.payload.status)
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
      } catch (e) {
        console.error(e) // TODO
        // TODO save failure
      }

      return {
        encoding: 'application/json',
        body: {
          ack: 'ack',
        },
      }
    },
  })
}

// TODO abstract this
function getResponseStatus(
  statusPayload: Exclude<Payload['status'], undefined>,
): AgeAssuranceStatePayload['status'] {
  if (statusPayload.verified) {
    return 'assured'
  } else {
    return 'unknown'
  }
}
