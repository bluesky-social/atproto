import { InvalidRequestError } from '@atproto/xrpc-server'
import * as id from '@atproto/identity'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.describeRepo(async ({ params }) => {
    const { repo } = params

    const account = await ctx.services.account(ctx.db).getAccount(repo)
    if (account === null) {
      throw new InvalidRequestError(`Could not find user: ${repo}`)
    }

    let didDoc
    try {
      didDoc = await ctx.idResolver.did.ensureResolve(account.did)
    } catch (err) {
      throw new InvalidRequestError(`Could not resolve DID: ${err}`)
    }

    const handle = id.getHandle(didDoc)
    const handleIsCorrect = handle === account.handle

    const collections = await ctx.services
      .record(ctx.db)
      .listCollectionsForDid(account.did)

    return {
      encoding: 'application/json',
      body: {
        handle: account.handle,
        did: account.did,
        didDoc,
        collections,
        handleIsCorrect,
      },
    }
  })
}
