import { jest } from '@jest/globals'
import { envToCfg } from '../src/config/config.js'
import { readEnv } from '../src/config/env.js'

describe('language tag record type configuration', () => {
  afterEach(() => jest.restoreAllMocks())

  const readConfig = (value?: string) => {
    jest.replaceProperty(process, 'env', {
      ...(value === undefined
        ? {}
        : { OZONE_LANGUAGE_TAG_RECORD_TYPES: value }),
    })
    return envToCfg({
      ...readEnv(),
      publicUrl: 'https://ozone.example.com',
      serverDid: 'did:plc:ozone',
      dbPostgresUrl: 'postgresql://localhost/ozone',
      appviewUrl: 'https://appview.example.com',
      appviewDid: 'did:plc:appview',
      didPlcUrl: 'https://plc.example.com',
    }).service.languageTagRecordTypes
  }

  it.each([
    [undefined, undefined],
    ['', undefined],
    ['  ', undefined],
    ['app.bsky.*', ['app.bsky.*']],
    ['app.bsky.feed.post', ['app.bsky.feed.post']],
    [' app.bsky.* , com.example.record ', ['app.bsky.*', 'com.example.record']],
    [
      '["app.bsky.*", "com.example.record"]',
      ['app.bsky.*', 'com.example.record'],
    ],
    ['[ " app.bsky.* " ]', ['app.bsky.*']],
    ['[]', []],
    ['*', ['*']],
  ])('parses %s', (value, expected) => {
    expect(readConfig(value)).toEqual(expected)
  })

  it.each([
    'app.bsky*',
    'app.*.post',
    'app.bsky.*,',
    ',app.bsky.*',
    'a.*',
    '["app.bsky.*",]',
    '["app.bsky.*", 42]',
    '["app.bsky.*", ""]',
    '[null]',
    '["app.bsky.*"',
  ])('rejects invalid pattern %s', (value) => {
    expect(() => readConfig(value)).toThrow('OZONE_LANGUAGE_TAG_RECORD_TYPES')
  })
})
