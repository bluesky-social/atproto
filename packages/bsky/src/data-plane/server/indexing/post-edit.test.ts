import { describe, expect, it } from 'vitest'
import { app } from '../../../lexicons/index.js'
import { InvalidPostEditError, validatePostEdit } from './post-edit.js'

const createdAt = '2026-01-01T00:00:00.000Z'

function post(overrides: Record<string, unknown> = {}) {
  return {
    $type: app.bsky.feed.post.$type,
    text: 'original',
    createdAt,
    langs: ['en'],
    facets: [
      {
        index: { byteStart: 0, byteEnd: 8 },
        features: [
          {
            $type: app.bsky.richtext.facet.mention.$type,
            did: 'did:plc:alice',
          },
        ],
      },
    ],
    embed: {
      $type: app.bsky.embed.images.$type,
      images: [
        {
          image: {
            $type: 'blob',
            ref: {
              $link:
                'bafkreigh2akiscaildcgwn4wmwfb55nn7z7iz23a47ii4cxivp6a3c4wya',
            },
            mimeType: 'image/jpeg',
            size: 1,
          },
          alt: 'original alt',
        },
      ],
    },
    labels: {
      $type: 'com.atproto.label.defs#selfLabels',
      values: [{ val: 'nudity' }],
    },
    ...overrides,
  }
}

describe(validatePostEdit, () => {
  it('accepts editable text, languages, facet ranges, alt text, and added labels', () => {
    const edited = post({
      text: 'edited',
      langs: ['fr'],
      facets: [
        {
          index: { byteStart: 1, byteEnd: 7 },
          features: [
            {
              $type: app.bsky.richtext.facet.mention.$type,
              did: 'did:plc:alice',
            },
          ],
        },
      ],
      embed: {
        ...post().embed,
        images: [
          {
            ...(post().embed as { images: Record<string, unknown>[] })
              .images[0],
            alt: 'edited alt',
          },
        ],
      },
      labels: {
        $type: 'com.atproto.label.defs#selfLabels',
        values: [{ val: 'nudity' }, { val: 'graphic-media' }],
      },
    })

    expect(() => validatePostEdit(post(), edited)).not.toThrow()
  })

  it.each([
    ['createdAt', { createdAt: '2026-01-02T00:00:00.000Z' }],
    [
      'facet feature',
      {
        facets: [
          {
            index: { byteStart: 0, byteEnd: 8 },
            features: [
              {
                $type: app.bsky.richtext.facet.mention.$type,
                did: 'did:plc:bob',
              },
            ],
          },
        ],
      },
    ],
    ['embed blob', { embed: undefined }],
    [
      'removed self-label',
      {
        labels: {
          $type: 'com.atproto.label.defs#selfLabels',
          values: [],
        },
      },
    ],
  ])('rejects a changed %s', (_name, overrides) => {
    expect(() => validatePostEdit(post(), post(overrides))).toThrow(
      InvalidPostEditError,
    )
  })
})
