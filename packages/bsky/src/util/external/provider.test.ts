import { describe, expect, test } from 'vitest'
import { site } from '../../lexicons/index.js'
import { getRecordProviderId } from './provider.js'

describe.each([
  {
    recordType: site.standard.document.$type,
    markerField: 'content',
    urlField: 'site',
  },
  {
    recordType: site.standard.publication.$type,
    markerField: 'theme',
    urlField: 'url',
  },
])('$recordType provider fallback', ({ recordType, markerField, urlField }) => {
  test.each([
    { note: 'missing', marker: undefined },
    { note: 'null', marker: null },
    { note: 'malformed', marker: 'not an object' },
    { note: 'unknown', marker: { $type: 'unknown.app.extension' } },
  ])('falls back to the URL for a $note marker', ({ marker }) => {
    const record = { $type: recordType, [markerField]: marker }
    expect(
      getRecordProviderId({
        ...record,
        [urlField]: 'https://author.pckt.blog',
      }),
    ).toBe('pckt.blog')
    expect(
      getRecordProviderId({
        ...record,
        [urlField]: 'https://custom.example.com',
      }),
    ).toBeUndefined()
  })
})
