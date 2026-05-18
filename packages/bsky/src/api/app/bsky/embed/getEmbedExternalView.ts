import { dedupeStrs } from '@atproto/common'
import { LexMap } from '@atproto/lex'
import { AtUri, AtUriString } from '@atproto/syntax'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { parseSiteStandardRecordKey } from '../../../../hydration/feed'
import { app, com } from '../../../../lexicons/index.js'
import { StrongRef } from '../../../../views/types.js'

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

      // associatedRefs and associatedRecords are returned as parallel arrays:
      // associatedRecords[i] is the raw record body for associatedRefs[i].
      const associatedRefs: StrongRef[] = []
      const associatedRecords: LexMap[] = []
      for (const [key, info] of documents) {
        if (!info) continue
        const { uri } = parseSiteStandardRecordKey(key)
        associatedRefs.push(
          com.atproto.repo.strongRef.$build({ uri, cid: info.cid }),
        )
        associatedRecords.push(info.record as LexMap)
      }
      for (const [key, info] of publications) {
        if (!info) continue
        const { uri } = parseSiteStandardRecordKey(key)
        associatedRefs.push(
          com.atproto.repo.strongRef.$build({ uri, cid: info.cid }),
        )
        associatedRecords.push(info.record as LexMap)
      }

      // No records hydrated -> nothing to give Cardy; it falls back to its
      // own link-card rendering and skips writing strongRefs.
      if (!associatedRefs.length) {
        return { encoding: 'application/json', body: {} }
      }

      // TODO(phase 2): build a viewExternal here, populating
      // createdAt/updatedAt/readingTime/source from the resolved document +
      // publication. Until then we only return raw refs and records; Cardy
      // continues to render the link card from its own HTML extraction.
      return {
        encoding: 'application/json',
        body: { associatedRefs, associatedRecords },
      }
    },
  })
}
