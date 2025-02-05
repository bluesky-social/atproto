import * as id from '@atproto/identity'
import { INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertRepoAvailability } from '../sync/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.describeRepo(async ({ params }) => {
    const { repo } = params

    const account = await assertRepoAvailability(ctx, repo, false)

    let didDoc
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
      encoding: 'application/json',
      body: {
        handle: account.handle ?? INVALID_HANDLE,
        did: account.did,
        didDoc,
        collections,
        handleIsCorrect,
      },
    }
  })
}
