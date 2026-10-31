import type { LexMap, TypedLexMap } from '@atproto/lex-data'
import { type AtUriString, isDidString } from '@atproto/lex-schema'
import { parseAtUriString } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { ServerConfig } from '../../../../config.js'
import type { AppContext } from '../../../../context.js'
import type { ExternalRecords } from '../../../../hydration/external.js'
import type {
  HydrateCtx,
  HydrationState,
  Hydrator,
} from '../../../../hydration/hydrator.js'
import { app, com, site, social } from '../../../../lexicons/index.js'
import {
  type HydrationFnInput,
  type PresentationFnInput,
  type SkeletonFnInput,
  createPipeline,
  noRules,
} from '../../../../pipeline.js'
import { isExternalRecordUrlSafe } from '../../../../util/external/index.js'
import {
  getStandardSiteRecordsForUri,
  validateStandardSiteRecordsForUrl,
} from '../../../../util/external/standard-site.js'
import type { Views } from '../../../../views/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  const getEmbedExternalView = createPipeline(
    skeleton,
    hydration,
    noRules,
    presentation,
  )
  server.add(app.bsky.embed.getEmbedExternalView, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        labelers,
        viewer,
        xrpcEndpoint: app.bsky.embed.getEmbedExternalView.$lxm,
      })
      const result = await getEmbedExternalView({ ...params, hydrateCtx }, ctx)
      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}

const skeleton = async (
  inputs: SkeletonFnInput<Context, Params>,
): Promise<Skeleton> => {
  return { canonicalUri: normalizeCanonicalUri(inputs.params) }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
): Promise<HydrationState> => {
  const { ctx, params, skeleton } = inputs
  if (!skeleton.canonicalUri) return { ctx: params.hydrateCtx }
  return ctx.hydrator.hydrateEmbedExternalViewFromUris(
    [skeleton.canonicalUri],
    params.hydrateCtx,
  )
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
): Output => {
  const { ctx, params, skeleton, hydration } = inputs
  const { canonicalUri } = skeleton
  if (!canonicalUri) return {}

  if (!hydration.externalRecords?.get(canonicalUri)) return {}

  const { associatedRefs, associatedRecords } = collectAssociations(
    canonicalUri,
    hydration.externalRecords,
  )

  // Validate before building any view: trust must not depend on whether the
  // records happen to be renderable.
  const standardSite = isStandardSiteUri(canonicalUri)
  const standardSiteRecords = standardSite
    ? getStandardSiteRecordsForUri(canonicalUri, hydration.externalRecords)
    : undefined
  const verified = standardSiteRecords
    ? validateStandardSiteRecordsForUrl(
        standardSiteRecords.document,
        standardSiteRecords.publication,
        params.url,
      )
    : isExternalRecordUrlSafe(params.url, ctx.cfg.externalRecordsSafeDomains)

  if (!verified) {
    return {
      unverifiedAssociatedRefs: associatedRefs,
      unverifiedAssociatedRecords: associatedRecords,
    }
  }

  const data = ctx.views.externalRecordView(canonicalUri, hydration)

  let view: Output['view']
  if (standardSiteRecords) {
    const standardSiteView = ctx.views.externalEmbedFromStandardSiteRecords({
      document: standardSiteRecords.document,
      publication: standardSiteRecords.publication,
      state: hydration,
      assumedUrl: params.url,
    })
    if (standardSiteView) {
      view = app.bsky.embed.external.view.$build({
        external: {
          ...standardSiteView,
          uri: params.url,
          associatedRefs: associatedRefs,
        },
      })
    }
  }

  return {
    view,
    data,
    associatedRefs: associatedRefs,
    associatedRecords: associatedRecords,
  }
}

type RecordUri = { uri: AtUriString; collection: string }

/** A complete DID-based record URI: record key present, no fragment. */
const parseRecordUri = (value: string): RecordUri | undefined => {
  const parsed = parseAtUriString(value)
  if (
    parsed.success &&
    isDidString(parsed.value.authority) &&
    parsed.value.collection &&
    parsed.value.rkey &&
    !parsed.value.hash
  ) {
    return { uri: value as AtUriString, collection: parsed.value.collection }
  }
  return undefined
}

const isStandardSiteUri = (uri: AtUriString): boolean => {
  const collection = parseRecordUri(uri)?.collection
  return (
    collection === site.standard.document.$type ||
    collection === site.standard.publication.$type
  )
}

/**
 * Reduce the request to one record URI. An explicit `canonicalUri` wins and
 * is never retried with `uris`. Otherwise the legacy `uris` input selects the
 * first Standard.site document, or else the first publication, regardless of
 * array order. No I/O: selection depends only on the supplied URIs.
 */
const normalizeCanonicalUri = (params: Params): AtUriString | undefined => {
  if (params.canonicalUri !== undefined) {
    return parseRecordUri(params.canonicalUri)?.uri
  }
  const candidates = (params.uris ?? []).flatMap((value) => {
    const parsed = parseRecordUri(value)
    return parsed ? [parsed] : []
  })
  const preferred =
    candidates.find((c) => c.collection === site.standard.document.$type) ??
    candidates.find((c) => c.collection === site.standard.publication.$type)
  return preferred?.uri
}

/**
 * Persistence policy, not render-time hydration: the canonical record (when
 * available, whatever its collection) plus only the additional collections
 * opted in here, so records baked into a post stay slim. Hydration still holds
 * the full state (e.g. recommendation, subscription and favorite records that
 * back the rendered `likers`/`subscribers` previews); those are deliberately
 * not persisted. An absent entry means no additional collections. Add a
 * collection here only when a post must carry it.
 */
const PERSISTED_DEPENDENCY_COLLECTIONS: ReadonlyMap<string, readonly string[]> =
  new Map<string, readonly string[]>([
    [site.standard.document.$type, [site.standard.publication.$type]],
    [
      social.grain.gallery.$type,
      [social.grain.gallery.item.$type, social.grain.photo.$type],
    ],
  ])

/**
 * The canonical record, then the hydrated dependencies whose URI collection is
 * opted in by `PERSISTED_DEPENDENCY_COLLECTIONS` for the canonical collection.
 * Refs and associatedRecords are index-aligned, with CIDs taken from
 * hydration; unavailable records are excluded.
 */
const collectAssociations = (
  canonicalUri: AtUriString,
  records: ExternalRecords,
): { associatedRefs: StrongRef[]; associatedRecords: LexMap[] } => {
  const associatedRefs: StrongRef[] = []
  const associatedRecords: LexMap[] = []
  const canonicalCollection = parseRecordUri(canonicalUri)?.collection
  const persisted =
    (canonicalCollection &&
      PERSISTED_DEPENDENCY_COLLECTIONS.get(canonicalCollection)) ||
    []
  const uris = [
    canonicalUri,
    ...[...records.keys()].filter((uri) => uri !== canonicalUri),
  ]
  for (const uri of uris) {
    const info = records.get(uri)
    if (!info) continue
    if (uri !== canonicalUri) {
      const collection = parseRecordUri(uri)?.collection
      if (!collection || !persisted.includes(collection)) continue
    }
    associatedRefs.push(
      com.atproto.repo.strongRef.$build({ uri, cid: info.cid }),
    )
    associatedRecords.push(info.record as TypedLexMap)
  }
  return { associatedRefs, associatedRecords }
}

type StrongRef = com.atproto.repo.strongRef.Main

type Context = {
  hydrator: Hydrator
  views: Views
  cfg: Pick<ServerConfig, 'externalRecordsSafeDomains'>
}

type Params = app.bsky.embed.getEmbedExternalView.$Params & {
  hydrateCtx: HydrateCtx
}

type Skeleton = {
  canonicalUri?: AtUriString
}

type Output = app.bsky.embed.getEmbedExternalView.$OutputBody
