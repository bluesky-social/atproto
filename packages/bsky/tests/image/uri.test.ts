import { CID } from 'multiformats/cid'
import { cidForCbor } from '@atproto/common'
import { BadPathError, ImageUriBuilder } from '../../src/image/uri'

describe('image uri builder', () => {
  let uriBuilder: ImageUriBuilder
  let cid: CID
  const did = 'did:plc:xyz'

  beforeAll(async () => {
    const endpoint = 'https://example.com/img'
    uriBuilder = new ImageUriBuilder(endpoint)
    cid = await cidForCbor('test cid')
  })

  it('generates paths.', () => {
    expect(
      ImageUriBuilder.getPath({ preset: 'banner', did, cid: cid.toString() }),
    ).toEqual(`/banner/plain/${did}/${cid.toString()}@jpeg`)
    expect(
      ImageUriBuilder.getPath({
        preset: 'feed_thumbnail',
        did,
        cid: cid.toString(),
      }),
    ).toEqual(`/feed_thumbnail/plain/${did}/${cid.toString()}@jpeg`)
  })

  it('generates uris.', () => {
    expect(uriBuilder.getPresetUri('banner', did, cid.toString())).toEqual(
      `https://example.com/img/banner/plain/${did}/${cid.toString()}@jpeg`,
    )
    expect(
      uriBuilder.getPresetUri('feed_thumbnail', did, cid.toString()),
    ).toEqual(
      `https://example.com/img/feed_thumbnail/plain/${did}/${cid.toString()}@jpeg`,
    )
  })

  it('parses options.', () => {
    expect(
      ImageUriBuilder.getOptions(`/banner/plain/${did}/${cid.toString()}@png`),
    ).toEqual({
      did: 'did:plc:xyz',
      cid: cid.toString(),
      fit: 'cover',
      format: 'png',
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
    expect(
      tryGetOptions(`/banner/plain/${did}/${cid.toString()}@webp`),
    ).toThrow(new BadPathError('Invalid path: bad format'))
  })

  function tryGetOptions(path: string) {
    return () => ImageUriBuilder.getOptions(path)
  }
})
