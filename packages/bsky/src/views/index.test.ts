import { describe, expect, it } from 'vitest'
import {
  type AtUriString,
  type DatetimeString,
  type DidString,
  type UriString,
  atUri,
  parseCid,
} from '@atproto/lex'
import type { Actor, ProfileLinks } from '../hydration/actor.js'
import { type ExternalRecord, genericRecordKey } from '../hydration/external.js'
import type { HydrationState } from '../hydration/hydrator.js'
import { type Label, Labels } from '../hydration/label.js'
import { HydrationMap } from '../hydration/util.js'
import { ImageUriBuilder } from '../image/uri.js'
import { app, com, site } from '../lexicons/index.js'
import { Views } from './index.js'
import { VideoUriBuilder } from './util.js'

const did = 'did:plc:linky' as DidString
const labelerDid = 'did:plc:labeler' as DidString
const createdAt = '2026-01-01T00:00:00.000Z' as DatetimeString
const cid = 'bafyreid6c2mfvztew4wrg7ld3m4o4ssbxz4miklv7u46mko3sjqdvaxzfa'
const linkUri = (rkey: string) => atUri(did, app.bsky.actor.link.$type, rkey)
const labeled = linkUri('labeled')
const plain = linkUri('plain')
const missing = linkUri('missing')
const icon = {
  $type: 'blob' as const,
  ref: parseCid('bafkreigh2akiscaildc5tww2o3w4g5ucuzji75ltsiqg2wfswnns66cinu'),
  mimeType: 'image/png',
  size: 100,
}

const views = new Views({
  imgUriBuilder: new ImageUriBuilder('https://cdn.example.com/img'),
  videoUriBuilder: new VideoUriBuilder({
    playlistUrlPattern: '',
    thumbnailUrlPattern: '',
  }),
  indexedAtEpoch: undefined,
  threadTagsBumpDown: [],
  threadTagsHide: [],
  visibilityTagHide: '',
  visibilityTagRankPrefix: '',
})

const makeLabel = (uri: UriString, val: string): Label => ({
  src: labelerDid,
  uri,
  val,
  cts: createdAt,
})

function addLabels(labels: Labels, uri: UriString, ...vals: string[]) {
  const entries = vals.map((val) => {
    const label = makeLabel(uri, val)
    return [Labels.key(label), label] as const
  })
  labels.set(uri, {
    isImpersonation: false,
    isTakendown: false,
    needsReview: false,
    labels: new HydrationMap(entries),
  })
}

function createState(): HydrationState & {
  actors: HydrationMap<DidString, Actor>
  profileLinks: ProfileLinks
  labels: Labels
} {
  const actors = new HydrationMap<DidString, Actor>()
  actors.set(did, {
    did,
    handle: 'linky.test' as never,
    isLabeler: false,
    verifications: [],
    allowActivitySubscriptionsFrom: 'none',
    accountModerationTags: new Set(),
    profileModerationTags: new Set(),
    profile: app.bsky.actor.profile.$build({
      links: [labeled, plain, missing].map((uri) => ({ uri, cid })),
    }),
  })
  return { actors, profileLinks: new HydrationMap(), labels: new Labels() }
}

function addLink(
  state: ReturnType<typeof createState>,
  uri: AtUriString,
  record: app.bsky.actor.link.Main,
) {
  state.profileLinks.set(uri, {
    record,
    cid,
    sortedAt: new Date(createdAt),
    indexedAt: new Date(createdAt),
    takedownRef: undefined,
  })
}

describe('Views.profileLinks', () => {
  it('exposes hydrated labels on the right link', () => {
    const state = createState()
    addLink(
      state,
      labeled,
      app.bsky.actor.link.$build({
        url: 'https://example.com',
        title: 'Example',
        icon,
        createdAt,
      }),
    )
    addLink(
      state,
      plain,
      app.bsky.actor.link.$build({ url: 'https://example.org', createdAt }),
    )
    addLabels(state.labels, labeled, 'spam')
    // Must not leak onto links.
    addLabels(state.labels, did, 'actor-label')
    addLabels(state.labels, linkUri('other'), 'x')

    const links = views.profileLinks(did, state)
    expect(links?.map((l) => l.uri)).toEqual([labeled, plain])
    for (const link of links ?? []) {
      expect(
        app.bsky.actor.defs.profileLinkView.$safeParse(link),
      ).toMatchObject({ success: true })
    }
    expect(links?.[0].labels).toEqual([makeLabel(labeled, 'spam')])
    expect(links?.[0].icon).toBe(
      `https://cdn.example.com/img/avatar/plain/${did}/${icon.ref}`,
    )
    expect(links?.[1].labels).toEqual([])
  })

  it('omits links that were nulled during hydration or never hydrated', () => {
    const state = createState()
    addLink(
      state,
      plain,
      app.bsky.actor.link.$build({ url: 'https://example.org', createdAt }),
    )
    state.profileLinks.set(labeled, null)
    addLabels(state.labels, labeled, '!takedown')

    const links = views.profileLinks(did, state)
    expect(links?.map((l) => l.uri)).toEqual([plain])
    expect(links?.[0].labels).toEqual([])
  })

  it('adds authored self-labels after hydrated labels on the same link', () => {
    const state = createState()
    // Non-normalized so the label timestamp proves it comes from the record.
    const authoredAt = '2026-02-03T04:05:06Z' as DatetimeString
    addLink(
      state,
      labeled,
      app.bsky.actor.link.$build({
        url: 'https://example.com',
        createdAt: authoredAt,
        labels: com.atproto.label.defs.selfLabels.$build({
          values: [{ val: 'porn' }, { val: 'gore' }],
        }),
      }),
    )
    addLink(
      state,
      plain,
      app.bsky.actor.link.$build({ url: 'https://example.org', createdAt }),
    )
    addLabels(state.labels, labeled, 'spam')
    addLabels(state.labels, did, 'actor-label')

    const links = views.profileLinks(did, state)
    for (const link of links ?? []) {
      expect(
        app.bsky.actor.defs.profileLinkView.$safeParse(link),
      ).toMatchObject({ success: true })
    }
    const selfLabel = (val: string) => ({
      src: did,
      uri: labeled,
      cid,
      val,
      cts: '2026-02-03T04:05:06.000Z',
    })
    expect(links?.[0].labels).toEqual([
      makeLabel(labeled, 'spam'),
      selfLabel('porn'),
      selfLabel('gore'),
    ])
    expect(links?.[1].labels).toEqual([])
  })

  it('adds no authored labels for empty self-labels', () => {
    const state = createState()
    addLink(
      state,
      labeled,
      app.bsky.actor.link.$build({
        url: 'https://example.com',
        createdAt,
        labels: com.atproto.label.defs.selfLabels.$build({ values: [] }),
      }),
    )
    expect(views.profileLinks(did, state)?.[0].labels).toEqual([])
  })

  it('omits unavailable links even when their records have self-labels', () => {
    const state = createState()
    addLink(
      state,
      labeled,
      app.bsky.actor.link.$build({
        url: 'https://example.com',
        createdAt,
        labels: com.atproto.label.defs.selfLabels.$build({
          values: [{ val: 'porn' }],
        }),
      }),
    )
    state.profileLinks.set(labeled, null)
    expect(views.profileLinks(did, state)).toBeUndefined()
  })
})

describe('Views.externalEmbed Standard.site roots', () => {
  const author = 'did:plc:author' as DidString
  const publisher = 'did:plc:publisher' as DidString
  const docUri = atUri(author, site.standard.document.$type, 'doc')
  const pubUri = atUri(publisher, site.standard.publication.$type, 'pub')
  const docRef = { uri: docUri, cid: 'doc-v1' }
  const pubRef = { uri: pubUri, cid: 'pub-v1' }
  const pageUrl = 'https://example.com/blog'
  const info = (record: object, recordCid: string): ExternalRecord => ({
    record: record as ExternalRecord['record'],
    cid: recordCid,
    sortedAt: new Date(createdAt),
    indexedAt: new Date(createdAt),
    takedownRef: undefined,
  })
  const pubRecord = (name = 'Publication') =>
    site.standard.publication.$build({ name, url: pageUrl })
  // An empty document path would let a publication-only overlay pass URL
  // validation for the page URL.
  const docRecord = site.standard.document.$build({
    site: pubUri,
    path: '',
    title: 'Document',
    publishedAt: createdAt,
  })
  const embedOf = (
    ...associatedRefs: { uri: AtUriString; cid: string }[]
  ): app.bsky.embed.external.Main =>
    app.bsky.embed.external.main.$build({
      external: {
        uri: pageUrl as UriString,
        title: 'Scraped',
        description: 'Scraped description',
        associatedRefs,
      },
    })
  const stateOf = (): HydrationState => ({
    ctx: undefined,
    actors: new HydrationMap(),
    labels: new Labels(),
    externalRecords: new HydrationMap([
      [pubUri, info(pubRecord('Latest publication'), 'pub-v2')],
    ]),
    externalRecordsByRef: new HydrationMap([
      [genericRecordKey(docRef), info(docRecord, docRef.cid)],
      [genericRecordKey(pubRef), info(pubRecord(), pubRef.cid)],
      // A newer latest version that the post did not pin.
      [
        genericRecordKey({ uri: pubUri, cid: 'pub-v2' }),
        info(pubRecord('Newer'), 'pub-v2'),
      ],
    ]),
  })
  // Generic hydration nulls the moderated root and keeps only its label.
  const takedown = (state: HydrationState, uri: AtUriString, hide = true) => {
    const ref = uri === docUri ? docRef : pubRef
    if (hide) {
      state.externalRecordsByRef!.set(genericRecordKey(ref), null)
      state.externalRecords?.set(uri, null)
    }
    state.labels!.set(uri, {
      isImpersonation: false,
      isTakendown: true,
      needsReview: false,
      labels: new HydrationMap(),
    })
  }

  it.each([[docRef, pubRef], [pubRef, docRef], [docRef]])(
    'overlays the pinned root and derived publication, keeping authored refs: %j',
    (...refs) => {
      const view = views.externalEmbed(author, embedOf(...refs), stateOf())
      expect(view.external).toMatchObject({
        title: 'Document',
        source: { title: 'Latest publication' },
        associatedRefs: refs,
      })
    },
  )

  it('ignores moderated authored refs that are not the root or its dependency', () => {
    const ignored = {
      uri: atUri(author, site.standard.publication.$type, 'ignored'),
      cid: 'ignored',
    }
    const state = stateOf()
    state.labels!.set(ignored.uri, {
      isImpersonation: false,
      isTakendown: true,
      needsReview: false,
      labels: new HydrationMap(),
    })
    const view = views.externalEmbed(author, embedOf(docRef, ignored), state)
    expect(view.external.title).toBe('Document')
  })

  it('never falls back to a legacy publication when the selected document is missing', () => {
    const state = stateOf()
    state.externalRecordsByRef!.set(genericRecordKey(docRef), null)
    const view = views.externalEmbed(author, embedOf(pubRef, docRef), state)
    expect(view.external.title).toBe('Scraped')
    expect(view.external.source).toBeUndefined()
  })

  it('keeps the bare card when nothing is pinned', () => {
    const view = views.externalEmbed(author, embedOf(), stateOf())
    expect(view.external).toMatchObject({
      title: 'Scraped',
      description: 'Scraped description',
    })
    expect(view.external.source).toBeUndefined()
  })

  it.each([docRef, pubRef])(
    'suppresses the overlay when pinned $uri is taken down',
    (taken) => {
      const state = stateOf()
      takedown(state, taken.uri)
      const view = views.externalEmbed(author, embedOf(docRef, pubRef), state)
      expect(view.external).toMatchObject({
        title: 'Scraped',
        associatedRefs: [docRef, pubRef],
      })
      expect(view.external.source).toBeUndefined()
    },
  )

  it('suppresses the overlay when a pinned owner is unavailable', () => {
    const state = stateOf()
    state.actors!.set(author, null)
    const view = views.externalEmbed(author, embedOf(docRef, pubRef), state)
    expect(view.external.title).toBe('Scraped')

    // Included takedowns bypass only the label gate.
    const included = stateOf()
    takedown(included, docUri, false)
    included.ctx = { includeTakedowns: true } as HydrationState['ctx']
    expect(
      views.externalEmbed(author, embedOf(docRef, pubRef), included).external
        .title,
    ).toBe('Document')
    included.actors!.set(author, null)
    expect(
      views.externalEmbed(author, embedOf(docRef, pubRef), included).external
        .title,
    ).toBe('Scraped')
  })

  it('keeps a healthy publication that another post pinned alone', () => {
    const state = stateOf()
    takedown(state, docUri)
    const view = views.externalEmbed(author, embedOf(pubRef), state)
    expect(view.external).toMatchObject({
      title: 'Publication',
      source: { title: 'Publication' },
    })
  })
})
