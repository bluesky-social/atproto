import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { GetIdentityByDidResponse } from '../../../../proto/bsky_pb'
import {
  Code,
  getServiceEndpoint,
  isDataplaneError,
  unpackIdentityServices,
} from '../../../../data-plane'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedGenerator({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { feed } = params
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      const hydration = await ctx.hydrator.hydrateFeedGens([feed], {
        viewer,
        labelers,
      })
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
    },
  })
}
