import { InvalidRequestError } from '@atproto/xrpc-server'

import AppContext from '../../../../context.js'
import {
  Code,
  getServiceEndpoint,
  isDataplaneError,
  unpackIdentityServices,
} from '../../../../data-plane/index.js'
import { Server } from '../../../../lexicon/index.js'
import { GetIdentityByDidResponse } from '../../../../proto/bsky_pb.js'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedGenerator({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createHandler(async (ctx, { params }) => {
      const { feed } = params

      const hydration = await ctx.hydrator.hydrateFeedGens([feed], ctx)
      const feedInfo = hydration.feedgens?.get(feed)
      if (!feedInfo) {
        throw new InvalidRequestError('could not find feed')
      }

      const feedDid = feedInfo.record.did
      let identity: GetIdentityByDidResponse
      try {
        identity = await ctx.dataplane.getIdentityByDid({ did: feedDid })
      } catch (err) {
        if (isDataplaneError(err, Code.NotFound)) {
          throw new InvalidRequestError(
            `could not resolve identity: ${feedDid}`,
          )
        }
        throw err
      }

      const services = unpackIdentityServices(identity.services)
      const fgEndpoint = getServiceEndpoint(services, {
        id: 'bsky_fg',
        type: 'BskyFeedGenerator',
      })
      if (!fgEndpoint) {
        throw new InvalidRequestError(
          `invalid feed generator service details in did document: ${feedDid}`,
        )
      }

      const feedView = ctx.views.feedGenerator(feed, hydration)
      if (!feedView) {
        throw new InvalidRequestError('could not find feed')
      }

      return {
        encoding: 'application/json',
        body: {
          view: feedView,
          // @TODO temporarily hard-coding to true while external feedgens catch-up on describeFeedGenerator
          isOnline: true,
          isValid: true,
        },
      }
    }),
  })
}
