import { dedupeStrs, mapDefined } from '@atproto/common'
import { AtUri, AtUriString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'

const SITE_STANDARD_NSID_PREFIX = 'site.standard.'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.embed.getEmbedExternalView, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params }) => {
      const uris = dedupeStrs(
        params.uris.filter((u) =>
          new AtUri(u).collection.startsWith(SITE_STANDARD_NSID_PREFIX),
        ),
      ) as AtUriString[]

      const { documents, publications } =
        await ctx.hydrator.feed.getSiteStandardRecordsByURI(uris)

      const associatedRecords = [
        ...mapDefined([...documents], ([uri, info]) =>
          info ? { uri, cid: info.cid } : undefined,
        ),
        ...mapDefined([...publications], ([uri, info]) =>
          info ? { uri, cid: info.cid } : undefined,
        ),
      ]

      // No records hydrated -> nothing to give Cardy; it falls back to its
      // own link-card rendering and skips writing strongRefs.
      if (!associatedRecords.length) {
        return { encoding: 'application/json', body: {} }
      }

      // TODO(phase 2): build a viewExternal here, populating
      // createdAt/updatedAt/readingTime/source from the resolved document +
      // publication. Until then we only return associatedRecords; Cardy
      // continues to render the link card from its own HTML extraction.
      return {
        encoding: 'application/json',
        body: { associatedRecords },
      }
    },
  })
}
