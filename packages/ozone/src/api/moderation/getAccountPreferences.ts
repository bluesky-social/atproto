import { buildAgent, xrpc } from '@atproto/lex'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { app, com, tools } from '../../lexicons/index.js'
import { createSafeFetch } from '../../safe-fetch.js'

export default function (server: Server, ctx: AppContext) {
  const fetch = ctx.cfg.service.devMode
    ? globalThis.fetch
    : createSafeFetch({ timeout: 30_000 })

  server.add(tools.ozone.moderation.getAccountPreferences, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params: { did: userDid } }) => {
      const { pds: pdsUrl } = await ctx.idResolver.did
        .resolveAtprotoData(userDid)
        .catch((cause) => {
          throw new InvalidRequestError(
            `Failed to resolve DID: ${userDid}`,
            undefined,
            { cause },
          )
        })

      // Create a safe agent to use with the PDS
      const pdsAgent = buildAgent({ service: pdsUrl, fetch })

      // We need the PDS's DID to generate the correct service auth headers
      const pdsDescription = await xrpc(
        pdsAgent,
        com.atproto.server.describeServer,
      )

      const auth = await ctx.serviceAuthHeaders(
        pdsDescription.body.did,
        app.bsky.actor.getPreferences.$lxm,
      )

      return xrpc(pdsAgent, app.bsky.actor.getPreferences, {
        // @NOTE `did` is a non-documented param for this endpoint that allows
        // the getPreferences call to return the preferences for a different
        // account than the one associated with the auth token.
        params: { did: userDid },
        headers: auth.headers,
      })
    },
  })
}
