import { InvalidRequestError } from '@atproto/xrpc-server'
import * as didResolver from '@atproto/did-resolver'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.describe(async ({ params }) => {
    const { user } = params

    const userObj = await ctx.services.account(ctx.db).getUser(user)
    if (userObj === null) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    let didDoc
    try {
      didDoc = await ctx.didResolver.ensureResolveDid(userObj.did)
    } catch (err) {
      throw new InvalidRequestError(`Could not resolve DID: ${err}`)
    }

    const handle = didResolver.getHandle(didDoc)
    const handleIsCorrect = handle === userObj.handle

    const collections = await ctx.services
      .record(ctx.db)
      .listCollectionsForDid(userObj.did)

    return {
      encoding: 'application/json',
      body: {
        handle: userObj.handle,
        did: userObj.did,
        didDoc,
        collections,
        handleIsCorrect,
      },
    }
  })
}
