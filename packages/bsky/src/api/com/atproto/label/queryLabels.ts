import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.label.queryLabels(async ({ params, req }) => {
    const { uriPatterns, sources } = params

    if (uriPatterns.find((uri) => uri.includes('*'))) {
      throw new InvalidRequestError('wildcards not supported')
    }

    const labelMap = await ctx.hydrator.label.getLabelsForSubjects(
      uriPatterns,
      // If sources are provided, use them. Otherwise, use the labelers from the request header
      sources
        ? {
            dids: sources,
            redact: new Set(),
          }
        : ctx.reqLabelers(req),
    )
    const labels = uriPatterns.map((uri) => labelMap.getBySubject(uri)).flat()

    return {
      encoding: 'application/json',
      body: {
        cursor: undefined,
        labels,
      },
    }
  })
}
