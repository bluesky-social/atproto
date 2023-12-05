import { InvalidRequestError } from '@atproto/xrpc-server'
import * as id from '@atproto/identity'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { proxy, resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.describeRepo(async ({ params }) => {
    const { repo } = params
    const accountService = ctx.services.account(ctx.db)
    const account = await accountService.getAccount(repo)
    if (account === null) {
      throw new InvalidRequestError(`Could not find user: ${repo}`)
    }

    const proxied = await proxy(ctx, account.pdsDid, async (agent) => {
      const result = await agent.api.com.atproto.repo.describeRepo(params)
      return resultPassthru(result)
    })
    if (proxied !== null) {
      return proxied
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
