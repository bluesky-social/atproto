import { MINUTE } from '@atproto/common'
import {
  type $Typed,
  type AtUriString,
  type DidString,
  type NsidString,
  type UriString,
  getBlobCidString,
  isAtUriString,
  isDidString,
} from '@atproto/lex'
import { AtUri, normalizeDatetimeAlways } from '@atproto/syntax'
import type { ExternalRecord } from '../hydration/external.js'
import type { HydrationState } from '../hydration/hydrator.js'
import { app, com, place, site, social } from '../lexicons/index.js'
import { estimateReadingTimeMinutes } from '../util/standard-site.js'
import { uriToDid } from '../util/uris.js'
import type { Views } from './index.js'
import type { ExternalRecordView, Label, ProfileViewBasic } from './types.js'

export const LIVESTREAM_HEARTBEAT_WINDOW_MS = 2 * MINUTE

/** Build a modality view from validated, available records in hydration state. */
export function externalRecordView(
  views: Views,
  uri: AtUriString,
  state: HydrationState,
  now: number,
): $Typed<ExternalRecordView> | undefined {
  const info = availableRecord(views, uri, state)
  if (!info) return
  const { record } = info

  if (site.standard.document.$matches(record)) {
    let publisher:
      $Typed<app.bsky.embed.external.ViewArticlePublication> | undefined
    let base = record.site
    const refs = [uri]
    if (isAtUriString(record.site)) {
      publisher = publicationView(views, record.site, state)
      if (!publisher) return
      base = publisher.uri
      refs.push(record.site)
    }
    const url = httpUri(
      record.path
        ? `${base.replace(/\/$/, '')}/${record.path.replace(/^\//, '')}`
        : base,
    )
    if (!url || !record.title) return
    return app.bsky.embed.external.viewArticle.$build({
      ...commonFields(views, refs, state),
      uri: url,
      title: record.title,
      description: record.description ?? '',
      createdAt: record.publishedAt,
      updatedAt: record.updatedAt,
      image: record.coverImage
        ? views.imgUriBuilder.getPresetUri(
            'feed_thumbnail',
            uriToDid(uri),
            getBlobCidString(record.coverImage),
          )
        : undefined,
      publisher,
      readingTime: record.textContent
        ? estimateReadingTimeMinutes(record.textContent)
        : undefined,
      likeCount: backlinkCount(uri, site.standard.graph.recommend.$type, state),
      likers: backlinkProfiles(views, uri, state, 'recommend'),
    })
  }

  if (site.standard.publication.$matches(record)) {
    return publicationView(views, uri, state)
  }

  if (social.grain.gallery.$matches(record)) {
    const links = (state.externalRecordBacklinks?.get(uri) ?? []).flatMap(
      (linkUri) => {
        const link = availableRecord(views, linkUri, state)?.record
        if (
          !social.grain.gallery.item.$matches(link) ||
          link.gallery !== uri ||
          uriToDid(linkUri) !== uriToDid(uri)
        ) {
          return []
        }
        return [{ uri: linkUri, record: link }]
      },
    )
    links.sort(
      (a, b) =>
        (a.record.position ?? 0) - (b.record.position ?? 0) ||
        compareStrings(a.uri, b.uri),
    )

    const refs = [uri]
    const seenPhotos = new Set<AtUriString>()
    const items: $Typed<app.bsky.embed.external.ViewGalleryImage>[] = []
    for (const link of links) {
      const photoUri = link.record.item
      if (seenPhotos.has(photoUri)) continue
      const photo = availableRecord(views, photoUri, state)?.record
      if (!social.grain.photo.$matches(photo)) continue
      seenPhotos.add(photoUri)
      refs.push(link.uri, photoUri)
      items.push(
        app.bsky.embed.external.viewGalleryImage.$build({
          thumbnail: views.imgUriBuilder.getPresetUri(
            'feed_thumbnail',
            uriToDid(photoUri),
            getBlobCidString(photo.photo),
          ),
          fullsize: views.imgUriBuilder.getPresetUri(
            'feed_fullsize',
            uriToDid(photoUri),
            getBlobCidString(photo.photo),
          ),
          alt: photo.alt,
          aspectRatio: photo.aspectRatio
            ? {
                width: photo.aspectRatio.width,
                height: photo.aspectRatio.height,
              }
            : undefined,
        }),
      )
    }
    return app.bsky.embed.external.viewGallery.$build({
      ...commonFields(views, refs, state),
      uri,
      title: record.title,
      description: record.description ?? '',
      createdAt: record.createdAt,
      items,
      likeCount: backlinkCount(uri, social.grain.favorite.$type, state),
      likers: backlinkProfiles(views, uri, state, 'favorite'),
    })
  }

  if (place.stream.livestream.$matches(record)) {
    const lastSeen = record.lastSeenAt ? Date.parse(record.lastSeenAt) : NaN
    // @NOTE The window applies on both sides of now to tolerate clock skew, so
    // a future heartbeat counts as live for at most twice the window.
    const fresh = Math.abs(now - lastSeen) < LIVESTREAM_HEARTBEAT_WINDOW_MS
    return app.bsky.embed.external.viewLivestream.$build({
      ...commonFields(views, [uri], state),
      uri: httpUri(record.canonicalUrl) ?? httpUri(record.url) ?? uri,
      title: record.title,
      description: '',
      createdAt: record.createdAt,
      image: record.thumb
        ? views.imgUriBuilder.getPresetUri(
            'feed_thumbnail',
            uriToDid(uri),
            getBlobCidString(record.thumb),
          )
        : undefined,
      active: !record.endedAt && fresh,
      startedAt: record.createdAt,
      endedAt: record.endedAt,
    })
  }
}

function publicationView(
  views: Views,
  uri: AtUriString,
  state: HydrationState,
): $Typed<app.bsky.embed.external.ViewArticlePublication> | undefined {
  const record = availableRecord(views, uri, state)?.record
  if (!site.standard.publication.$matches(record)) return
  const url = httpUri(record.url)
  if (!url || !record.name) return
  return app.bsky.embed.external.viewArticlePublication.$build({
    ...commonFields(views, [uri], state),
    uri: url,
    title: record.name,
    description: record.description ?? '',
    logo: record.icon
      ? views.imgUriBuilder.getPresetUri(
          'avatar',
          uriToDid(uri),
          getBlobCidString(record.icon),
        )
      : undefined,
    theme: record.basicTheme
      ? app.bsky.embed.external.viewArticlePublicationTheme.$build({
          background: hexColor(record.basicTheme.background),
          foreground: hexColor(record.basicTheme.foreground),
          accent: hexColor(record.basicTheme.accent),
          accentForeground: hexColor(record.basicTheme.accentForeground),
        })
      : undefined,
    subscriptionCount: backlinkCount(
      uri,
      site.standard.graph.subscription.$type,
      state,
    ),
    subscribers: backlinkProfiles(views, uri, state, 'subscription'),
  })
}

function availableRecord(
  views: Views,
  uri: AtUriString,
  state: HydrationState,
): ExternalRecord | undefined {
  const info = state.externalRecords?.get(uri)
  if (!info) return
  const parsed = new AtUri(uri)
  if (!isDidString(parsed.host) || parsed.collection !== info.record.$type)
    return
  // @NOTE Actor hydration nulls unavailable accounts (missing and tombstoned
  // ones even with includeTakedowns). Absent entries just weren't hydrated.
  if (state.actors?.get(parsed.host) === null) return
  if (views.viewerBlockExists(parsed.host, state)) return
  if (!views.viewerSeesNeedsReview({ uri }, state)) return
  if (
    !state.ctx?.includeTakedowns &&
    (info.takedownRef ||
      state.labels?.get(uri)?.isTakendown ||
      views.actorIsNoHosted(parsed.host, state))
  ) {
    return
  }
  return info
}

function commonFields(
  views: Views,
  uris: AtUriString[],
  state: HydrationState,
) {
  const refs = [...new Set(uris)]
  const dids = [...new Set(refs.map(uriToDid))]
  return {
    associatedRefs: refs.map((uri) =>
      com.atproto.repo.strongRef.$build({
        uri,
        cid: state.externalRecords!.get(uri)!.cid,
      }),
    ),
    associatedProfiles: dids.flatMap((did) => {
      const profile = views.profileBasic(did, state)
      return profile ? [profile] : []
    }),
    labels: refs.flatMap((uri) =>
      recordLabels(uri, state.externalRecords!.get(uri)!, state),
    ),
  }
}

function recordLabels(
  uri: AtUriString,
  info: ExternalRecord,
  state: HydrationState,
): Label[] {
  const labels = state.labels?.getBySubject(uri) ?? []
  const selfLabels = info.record.labels
  if (!com.atproto.label.defs.selfLabels.$matches(selfLabels)) return labels
  const createdAt = info.record.createdAt ?? info.record.publishedAt
  const cts =
    typeof createdAt === 'string'
      ? normalizeDatetimeAlways(createdAt)
      : '1970-01-01T00:00:00.000Z'
  return [
    ...labels,
    ...selfLabels.values.map(({ val }) => ({
      src: uriToDid(uri),
      uri,
      cid: info.cid,
      val,
      cts,
    })),
  ]
}

function backlinkCount(
  uri: AtUriString,
  collection: NsidString,
  state: HydrationState,
): number | undefined {
  const counts = state.externalRecordBacklinkCounts?.get(uri)
  if (!counts) return
  const count = counts[collection] ?? 0
  return Number.isSafeInteger(count) && count >= 0 ? count : undefined
}

function backlinkProfiles(
  views: Views,
  uri: AtUriString,
  state: HydrationState,
  kind: 'recommend' | 'subscription' | 'favorite',
): ProfileViewBasic[] | undefined {
  const backlinks = state.externalRecordBacklinks?.get(uri)
  if (!backlinks) return
  const dids = new Set<DidString>()
  for (const backlink of backlinks) {
    const record = availableRecord(views, backlink, state)?.record
    const matches =
      kind === 'recommend'
        ? site.standard.graph.recommend.$matches(record) &&
          record.document === uri
        : kind === 'subscription'
          ? site.standard.graph.subscription.$matches(record) &&
            record.publication === uri
          : social.grain.favorite.$matches(record) && record.subject === uri
    if (matches) dids.add(uriToDid(backlink))
  }
  const profiles: ProfileViewBasic[] = []
  for (const did of [...dids].sort(compareStrings)) {
    const profile = views.profileBasic(did, state)
    if (profile) profiles.push(profile)
    if (profiles.length === 3) break
  }
  return profiles
}

function hexColor(
  color: site.standard.theme.basic.Main['background'],
): string | undefined {
  if (site.standard.theme.color.rgb.$matches(color)) {
    return `#${[color.r, color.g, color.b].map(hexByte).join('')}`
  }
}

function hexByte(value: number): string {
  return value.toString(16).padStart(2, '0')
}

function httpUri(value: string | undefined): UriString | undefined {
  if (!value) return
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:')
      return url.href as UriString
  } catch {
    return
  }
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
