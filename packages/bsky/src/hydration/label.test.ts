import { Timestamp } from '@bufbuild/protobuf'
import { createPromiseClient, createRouterTransport } from '@connectrpc/connect'
import { describe, expect, it, test, vi } from 'vitest'
import { type DidString, type UriString, atUri } from '@atproto/lex'
import { app } from '../lexicons/index.js'
import { Service } from '../proto/bsky_connect.js'
import { type GetTagsForSubjectsRequest, Tag } from '../proto/bsky_pb.js'
import type { ParsedLabelers } from '../util.js'
import { LabelHydrator, Labels } from './label.js'

const source: DidString = 'did:example:moderation'
const moderator = 'did:example:moderator'
const subject: DidString = 'did:example:author'
const post = atUri(subject, app.bsky.feed.post.$type, 'post')
const now = Date.parse('2026-10-20T12:00:00.000Z')
const labelers: ParsedLabelers = { dids: [source], redact: new Set([source]) }

function createFixture(sources: readonly DidString[] = [source]) {
  const tags: Tag[] = []
  const labels: Uint8Array[] = []
  const requests: GetTagsForSubjectsRequest[] = []
  const dataplane = createPromiseClient(
    Service,
    createRouterTransport((router) => {
      router.service(Service, {
        getLabels: () => ({ labels }),
        getTagsForSubjects: (req) => {
          requests.push(req)
          return { tags }
        },
      })
    }),
  )
  const hydrator = new LabelHydrator(dataplane, sources)
  return {
    tags,
    labels,
    requests,
    hydrate: (subjects: UriString[] = [subject, post], opts = labelers) =>
      hydrator.getLabelsForSubjects(subjects, opts),
  }
}

function tag(overrides: ConstructorParameters<typeof Tag>[0] = {}) {
  return new Tag({
    subject,
    issuer: moderator,
    value: 'needs-review',
    event: { source, eventId: 1n },
    ...overrides,
  })
}

function label(val = 'needs-review') {
  return new TextEncoder().encode(
    JSON.stringify({
      src: source,
      uri: subject,
      val,
      cts: new Date(now).toISOString(),
    }),
  )
}

describe(LabelHydrator, () => {
  it('batches account and exact record tags and keeps them out of public labels', async () => {
    const fixture = createFixture()
    fixture.tags.push(tag(), tag({ subject: post }))
    const state = await fixture.hydrate()
    expect(fixture.requests).toMatchObject([
      { subjects: [subject, post], sources: [source] },
    ])
    expect(state.get(subject)?.needsReview).toBe(true)
    expect(state.get(post)?.needsReview).toBe(true)
    expect(state.getBySubject(subject)).toEqual([])
    expect(state.getBySubject(post)).toEqual([])
  })

  test.each([
    {
      name: 'untrusted source',
      overrides: { event: { source: 'did:example:other' }, issuer: source },
    },
    { name: 'missing source', overrides: { event: undefined } },
    { name: 'different value', overrides: { value: 'other' } },
    { name: 'different subject', overrides: { subject: 'did:example:other' } },
    { name: 'removed', overrides: { removed: true } },
    {
      name: 'expired',
      overrides: { expiresAt: Timestamp.fromDate(new Date(now - 1)) },
    },
    {
      name: 'expiry boundary',
      overrides: { expiresAt: Timestamp.fromDate(new Date(now)) },
    },
  ])('ignores $name', async ({ overrides }) => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const fixture = createFixture()
    fixture.tags.push(tag(overrides))
    expect((await fixture.hydrate()).get(subject)?.needsReview).not.toBe(true)
  })

  test.each([
    { name: 'no trusted sources', sources: [], opts: labelers },
    {
      name: 'no labelers',
      sources: [source],
      opts: { dids: [], redact: new Set<DidString>() },
    },
    {
      name: 'not redacting',
      sources: [source],
      opts: { dids: [source], redact: new Set<DidString>() },
    },
    {
      name: 'source not selected',
      sources: [source],
      opts: {
        dids: ['did:example:other' as DidString],
        redact: new Set([source]),
      },
    },
  ])('does not query tags when $name', async ({ sources, opts }) => {
    const fixture = createFixture(sources)
    fixture.tags.push(tag())
    expect(
      (await fixture.hydrate([subject], opts)).get(subject)?.needsReview,
    ).not.toBe(true)
    expect(fixture.requests).toEqual([])
  })

  it('does not query an empty batch', async () => {
    const fixture = createFixture()
    expect((await fixture.hydrate([])).size).toBe(0)
    expect(fixture.requests).toEqual([])
  })

  it('checks expiry again when the same response is reused', async () => {
    using clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const fixture = createFixture()
    fixture.tags.push(
      tag({ expiresAt: Timestamp.fromDate(new Date(now + 1000)) }),
    )
    expect((await fixture.hydrate()).get(subject)?.needsReview).toBe(true)
    clock.mockReturnValue(now + 1000)
    expect((await fixture.hydrate()).get(subject)?.needsReview).not.toBe(true)
  })

  it('preserves label enforcement when a tag expires or is removed', async () => {
    using _clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const fixture = createFixture()
    fixture.labels.push(label())
    fixture.tags.push(tag({ removed: true }))
    expect((await fixture.hydrate()).get(subject)?.needsReview).toBe(true)
    expect((await fixture.hydrate()).getBySubject(subject)).toEqual([])
  })

  it('preserves ordinary labels alongside a tag', async () => {
    const fixture = createFixture()
    fixture.labels.push(label('spam'))
    fixture.tags.push(tag())
    const state = await fixture.hydrate()
    expect(state.get(subject)?.needsReview).toBe(true)
    expect(state.getBySubject(subject)).toMatchObject([{ val: 'spam' }])
  })

  it('preserves label-only behavior when no tags are returned', async () => {
    const fixture = createFixture()
    fixture.labels.push(label())
    expect((await fixture.hydrate()).get(subject)?.needsReview).toBe(true)
    expect(fixture.requests).toHaveLength(1)
  })

  it('does not query tags for public label queries', async () => {
    const fixture = createFixture()
    fixture.labels.push(label())
    const state = await fixture.hydrate([subject], {
      dids: [source],
      redact: new Set(),
    })
    expect(state.getBySubject(subject)).toMatchObject([{ val: 'needs-review' }])
    expect(fixture.requests).toEqual([])
  })

  it('keeps needs-review when hydration results for the same subject merge', async () => {
    const fixture = createFixture()
    fixture.tags.push(tag())
    const tagged = await fixture.hydrate()
    fixture.tags.length = 0
    fixture.labels.push(label('spam'))
    const labeled = await fixture.hydrate()
    for (const [first, second] of [
      [tagged, labeled],
      [labeled, tagged],
    ]) {
      const merged = new Labels().merge(first).merge(second)
      expect(merged.get(subject)?.needsReview).toBe(true)
      expect(merged.getBySubject(subject)).toMatchObject([{ val: 'spam' }])
    }
  })
})
