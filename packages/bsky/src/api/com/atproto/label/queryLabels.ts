import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.label.queryLabels(async ({ params }) => {
    const { uriPatterns, sources } = params

    if (uriPatterns.find((uri) => uri.includes('*'))) {
      throw new InvalidRequestError('wildcards not supported')
    }

    if (!sources?.length) {
      throw new InvalidRequestError('source dids are required')
    }

    const labelMap = await ctx.hydrator.label.getLabelsForSubjects(
      uriPatterns,
      // If sources are provided, use them. Otherwise, use the labelers from the request header
      {
        dids: sources,
        redact: new Set(),
      },
    )
    const labels = uriPatterns.flatMap((uri) => labelMap.getBySubject(uri))

    return {
      encoding: 'application/json',
      body: {
        cursor: undefined,
        labels,
      },
    }
  })
}
