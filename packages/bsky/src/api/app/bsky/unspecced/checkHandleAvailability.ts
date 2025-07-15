import { isEmailValid } from '@hapi/address'
import * as ident from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/unspecced/checkHandleAvailability'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.checkHandleAvailability({
    handler: async ({ params }) => {
      const { birthDate, email, handle } = validateParams(params)

      const [did] = await ctx.hydrator.actor.getDids([handle], {
        lookupUnidirectional: true,
      })
      if (!did) {
        return {
          encoding: 'application/json',
          body: {
            handle,
            result: {
              $type:
                'app.bsky.unspecced.checkHandleAvailability#resultAvailable',
            },
          },
        }
      }

      const suggestions = await generateSuggestions(
        ctx,
        handle,
        birthDate,
        email,
      )
      return {
        encoding: 'application/json',
        body: {
          handle,
          result: {
            $type:
              'app.bsky.unspecced.checkHandleAvailability#resultUnavailable',
            suggestions,
          },
        },
      }
    },
  })
}

const validateParams = (params: QueryParams) => {
  const { email } = params
  if (email && !isEmailValid(email)) {
    throw new InvalidRequestError('Invalid email address.', 'InvalidEmail')
  }

  return {
    birthDate: params.birthDate,
    email,
    handle: ident.normalizeHandle(params.handle),
  }
}

const generateSuggestions = (
  _ctx: AppContext,
  _handle: string,
  _birthDate: string | undefined,
  _email: string | undefined,
) => {
  return []
}
