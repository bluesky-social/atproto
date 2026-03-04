import { CID } from 'multiformats/cid'
import { cidForCbor } from '@atproto/common'
import { BadPathError, ImageUriBuilder } from '../../src/image/uri'

describe('image uri builder', () => {
  const endpoint = 'https://example.com/img'
  let uriBuilder: ImageUriBuilder
  let cid: CID
  const did = 'did:plc:xyz'

  beforeAll(async () => {
    uriBuilder = new ImageUriBuilder(endpoint)
    cid = await cidForCbor('test cid')
  })

  it('generates paths.', () => {
    expect(
      ImageUriBuilder.getPath({ preset: 'banner', did, cid: cid.toString() }),
    ).toEqual(`/banner/plain/${did}/${cid.toString()}`)
    expect(
      ImageUriBuilder.getPath({
        preset: 'feed_thumbnail',
        did,
        cid: cid.toString(),
      }),
    ).toEqual(`/feed_thumbnail/plain/${did}/${cid.toString()}`)
  })

  it('generates uris.', () => {
    expect(uriBuilder.getPresetUri('banner', did, cid.toString())).toEqual(
      `https://example.com/img/banner/plain/${did}/${cid.toString()}`,
    )
    expect(
      uriBuilder.getPresetUri('feed_thumbnail', did, cid.toString()),
    ).toEqual(
      `https://example.com/img/feed_thumbnail/plain/${did}/${cid.toString()}`,
    )
  })

  it('parses options.', () => {
    expect(
      ImageUriBuilder.getOptions(`/banner/plain/${did}/${cid.toString()}@webp`),
    ).toEqual({
      did: 'did:plc:xyz',
      cid: cid.toString(),
      fit: 'cover',
      format: 'webp',
      height: 1000,
      min: true,
      preset: 'banner',
      width: 3000,
    })
    expect(
      ImageUriBuilder.getOptions(
        `/feed_thumbnail/plain/${did}/${cid.toString()}@jpeg`,
      ),
    ).toEqual({
      did: 'did:plc:xyz',
      cid: cid.toString(),
      fit: 'inside',
      format: 'jpeg',
      height: 2000,
      min: true,
      preset: 'feed_thumbnail',
      width: 2000,
    })
    expect(
      ImageUriBuilder.getOptions(
        `/feed_thumbnail/plain/${did}/${cid.toString()}`,
      ),
    ).toEqual({
      did: 'did:plc:xyz',
      cid: cid.toString(),
      fit: 'inside',
      format: 'webp',
      height: 2000,
      min: true,
      preset: 'feed_thumbnail',
      width: 2000,
    })
  })

  it('includes format in path based on level', () => {
    const did = 'did:example:alice'
    const base = `https://example.com/img/avatar/plain/${did}`
    let builder = new ImageUriBuilder(endpoint, 0)
    expect(builder.getPresetUri('avatar', did, 'bafka')).toBe(`${base}/bafka`)
    expect(builder.getPresetUri('avatar', did, 'bafk7')).toBe(`${base}/bafk7`)
    builder = new ImageUriBuilder(endpoint, 1)
    expect(builder.getPresetUri('avatar', did, 'bafka')).toBe(
      `${base}/bafka@webp`,
    )
    expect(builder.getPresetUri('avatar', did, 'bafkb')).toBe(
      `${base}/bafkb@webp`,
    )
    expect(builder.getPresetUri('avatar', did, 'bafkc')).toBe(`${base}/bafkc`)
    expect(builder.getPresetUri('avatar', did, 'bafk7')).toBe(`${base}/bafk7`)
    builder = new ImageUriBuilder(endpoint, 8)
    expect(builder.getPresetUri('avatar', did, 'bafka')).toBe(
      `${base}/bafka@webp`,
    )
    expect(builder.getPresetUri('avatar', did, 'bafkp')).toBe(
      `${base}/bafkp@webp`,
    )
    expect(builder.getPresetUri('avatar', did, 'bafkq')).toBe(`${base}/bafkq`)
    expect(builder.getPresetUri('avatar', did, 'bafk7')).toBe(`${base}/bafk7`)
    builder = new ImageUriBuilder(endpoint, 16)
    expect(builder.getPresetUri('avatar', did, 'bafka')).toBe(
      `${base}/bafka@webp`,
    )
    expect(builder.getPresetUri('avatar', did, 'bafk7')).toBe(
      `${base}/bafk7@webp`,
    )
  })

  it('errors on bad url pattern.', () => {
    expect(tryGetOptions(`/a`)).toThrow(new BadPathError('Invalid path'))
    expect(tryGetOptions(`/banner/plain/${did}@jpeg`)).toThrow(
      new BadPathError('Invalid path'),
    )
  })

  it('errors on bad preset.', () => {
    expect(
      tryGetOptions(`/bad_banner/plain/${did}/${cid.toString()}@jpeg`),
    ).toThrow(new BadPathError('Invalid path: bad preset'))
  })

  it('errors on bad format.', () => {
    expect(tryGetOptions(`/banner/plain/${did}/${cid.toString()}@gif`)).toThrow(
      new BadPathError('Invalid path: bad format'),
    )
  })

  function tryGetOptions(path: string) {
    return () => ImageUriBuilder.getOptions(path)
  }
})
