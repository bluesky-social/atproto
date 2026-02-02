import * as id from '@atproto/identity'
import { DidString, HandleString, INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { assertRepoAvailability } from '../sync/util'

export default function (server: Server, ctx: AppContext) {
  server.add(
    com.atproto.repo.describeRepo,
    async ({ params }): Promise<com.atproto.repo.describeRepo.Output> => {
      const { repo } = params

      const account = await assertRepoAvailability(ctx, repo, false)

      let didDoc: id.DidDocument
      try {
        didDoc = await ctx.idResolver.did.ensureResolve(account.did)
      } catch (err) {
        throw new InvalidRequestError(`Could not resolve DID: ${err}`)
      }

      const handle = id.getHandle(didDoc)
      const handleIsCorrect = handle === account.handle

      const collections = await ctx.actorStore.read(account.did, (store) =>
        store.record.listCollections(),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          handle: (account.handle ?? INVALID_HANDLE) as HandleString,
          did: account.did as DidString,
          // @ts-expect-error https://github.com/bluesky-social/atproto/pull/4406
          didDoc,
          collections,
          handleIsCorrect,
        },
      }
    },
  )
}
