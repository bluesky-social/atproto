import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.getRecord(async ({ params, req }) => {
    const { repo, collection, rkey, cid } = params
    const [did] = await ctx.hydrator.actor.getDids([repo])
    if (!did) {
      throw new InvalidRequestError(`Could not find repo: ${repo}`)
    }

    const uri = AtUri.make(did, collection, rkey).toString()
    const result = await ctx.hydrator.getRecord(uri, true)

    if (!result || (cid && result.cid !== cid)) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }

    const labelers = ctx.reqLabelers(req)
    const labelMap = await ctx.hydrator.label.getLabelsForSubjects(
      [uri],
      labelers,
    )
    const labels = Array.from(labelMap.get(uri)?.labels?.values() || [])

    return {
      encoding: 'application/json' as const,
      body: {
        uri: uri,
        cid: result.cid,
        value: {
          ...result.record,
        },
        labels,
      },
    }
  })
}
