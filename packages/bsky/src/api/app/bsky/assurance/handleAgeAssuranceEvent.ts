import crypto from 'node:crypto'

import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { AgeAssuranceState } from '../../../../lexicon/types/app/bsky/assurance/defs'
import { Payload } from '../../../../lexicon/types/app/bsky/assurance/handleAgeAssuranceEvent'

import { WEBHOOK_SECRET } from './env'

type StatusPayload = {
  verified: true
  transactionId: string
  errorCode: string | null
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.assurance.handleAgeAssuranceEvent({
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
          .createHmac('sha256', WEBHOOK_SECRET)
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
        const { did } = JSON.parse(input.body.payload.externalPayload) as {
          did: string
        }

        if (!did) {
          throw new Error('Missing DID in externalPayload')
        }

        const status = getResponseStatus(input.body.payload.status)

        try {
          await ctx.stashClient.update({
            actorDid: did,
            namespace: 'app.bsky.assurance.defs#ageAssuranceState',
            key: 'self',
            payload: {
              required: true,
              status,
            },
          })
        } catch (e) {
          // TODO handle stash update failure
        }
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

function getResponseStatus(
  statusPayload: Exclude<Payload['status'], undefined>,
): AgeAssuranceState['status'] {
  if (statusPayload.verified) {
    return 'verified-adult'
  } else {
    return 'unverified'
  }
}
