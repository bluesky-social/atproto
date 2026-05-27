import { parseCid } from '@atproto/lex-data'
import { BlobNotFoundError } from '@atproto/repo'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getBlob, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth, res }) => {
      const { space, repo } = params

      if (auth.credentials.type === 'space_credential') {
        if (auth.credentials.space !== space) {
          throw new InvalidRequestError('Credential space mismatch')
        }
      } else {
        assertSpaceScope(auth, space, { action: 'read' })
      }

      const cid = parseCid(params.cid)
      const found = await ctx.actorStore.read(repo, async (store) => {
        try {
          return await store.repo.blob.getBlob(cid)
        } catch (err) {
          if (err instanceof BlobNotFoundError) {
            throw new InvalidRequestError('Blob not found', 'BlobNotFound')
          } else {
            throw err
          }
        }
      })
      if (!found) {
        throw new InvalidRequestError('Blob not found', 'BlobNotFound')
      }
      res.setHeader('content-length', found.size)
      res.setHeader('x-content-type-options', 'nosniff')
      res.setHeader('content-disposition', `attachment; filename="${cid}"`)
      res.setHeader('content-security-policy', `default-src 'none'; sandbox`)

      return {
        encoding: found.mimeType || ('application/octet-stream' as const),
        body: found.stream,
      }
    },
  })
}
