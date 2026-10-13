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
import type { HydrationState } from '../hydration/hydrator.js'
import { type Label, Labels } from '../hydration/label.js'
import { HydrationMap } from '../hydration/util.js'
import { ImageUriBuilder } from '../image/uri.js'
import { app } from '../lexicons/index.js'
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
})
