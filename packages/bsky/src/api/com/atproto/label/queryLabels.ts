import { isValidAtUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.label.queryLabels, async ({ params }) => {
    const { uriPatterns, sources } = params

    if (!sources?.length) {
      throw new InvalidRequestError('source dids are required')
    }

    if (uriPatterns.some(includesWildcard)) {
      throw new InvalidRequestError('wildcards not supported')
    }

    // @TODO Should this be enforced at the schema level?
    if (!uriPatterns.every(isValidAtUri)) {
      throw new InvalidRequestError('invalid uri pattern')
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

function includesWildcard(str: string) {
  return str.includes('*')
}
