import { SpaceUriString } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getRecord, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, repo, collection, rkey } = params

      if (auth.credentials.type === 'space_credential') {
        if (auth.credentials.space !== space) {
          throw new InvalidRequestError('Credential space mismatch')
        }
      } else {
        // OAuth/access auth must carry a `space:?action=read` (or default)
        // scope on the (type, did, skey) of the requested space.
        assertSpaceScope(auth, space, { action: 'read' })
      }

      const record = await ctx.actorStore.read(repo, (store) =>
        store.space.getRecord(space, collection, rkey),
      )
      if (!record) {
        throw new InvalidRequestError(
          `Could not locate record: ${space}/${collection}/${rkey}`,
          'RecordNotFound',
        )
      }

      return {
        encoding: 'application/json' as const,
        body: {
          uri: `${space}/${repo}/${collection}/${rkey}` as SpaceUriString,
          cid: record.cid,
          value: record.value,
        },
      }
    },
  })
}
