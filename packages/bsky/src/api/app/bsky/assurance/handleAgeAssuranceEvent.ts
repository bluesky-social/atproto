import crypto from 'node:crypto'

import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

import { WEBHOOK_SECRET } from './env'

export default function (server: Server, _ctx: AppContext) {
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

        console.log('handleAgeAssuranceEvent SUCCESS')

        // TODO save
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
