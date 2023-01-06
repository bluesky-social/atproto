import { cidForCbor } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { ImageUriBuilder, BadPathError } from '../../src/image/uri'

describe('image uri builder', () => {
  let uriBuilder: ImageUriBuilder
  let cid: CID

  beforeAll(async () => {
    const endpoint = 'https://example.com'
    const salt = '9dd04221f5755bce5f55f47464c27e1e'
    const key =
      'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8'
    uriBuilder = new ImageUriBuilder(endpoint, salt, key)
    cid = await cidForCbor('test cid')
  })

  it('signs and verifies uri options.', () => {
    const path = uriBuilder.getSignedPath({
      cid,
      format: 'png',
      height: 200,
      width: 300,
    })
    expect(path).toEqual(
      `/8Lpp5Y4ZQFkwTxDDgc1hz8haG6-lUBHsGsyNYoDEaXc/rs:fill:300:200:0:0/plain/${cid.toString()}@png`,
    )
    expect(uriBuilder.getVerifiedOptions(path)).toEqual({
      signature: '8Lpp5Y4ZQFkwTxDDgc1hz8haG6-lUBHsGsyNYoDEaXc',
      cid,
      format: 'png',
      fit: 'cover',
      height: 200,
      width: 300,
      min: false,
    })
  })

  it('errors on bad signature.', () => {
    const tryGetVerifiedOptions = (path) => () =>
      uriBuilder.getVerifiedOptions(path)

    tryGetVerifiedOptions(
      // Confirm this is a good signed uri
      `/BtHM_4IOak5MOc2gOPDxbfS4_HG6VPcry2OAV03L29g/rs:fill:300:200:0:0/plain/${cid.toString()}@png`,
    )

    expect(
      tryGetVerifiedOptions(
        // Tamper with signature
        `/DtHM_4IOak5MOc2gOPDxbfS4_HG6VPcry2OAV03L29g/rs:fill:300:200:0:0/plain/${cid.toString()}@png`,
      ),
    ).toThrow(new BadPathError('Invalid path: bad signature'))

    expect(
      tryGetVerifiedOptions(
        // Tamper with params
        `/DtHM_4IOak5MOc2gOPDxbfS4_HG6VPcry2OAV03L29g/rs:fill:300:200:0:0/plain/${cid.toString()}@jpeg`,
      ),
    ).toThrow(new BadPathError('Invalid path: bad signature'))

    expect(
      tryGetVerifiedOptions(
        // Missing signature
        `/rs:fill:300:200:0:0/plain/${cid.toString()}@jpeg`,
      ),
    ).toThrow(new BadPathError('Invalid path: missing signature'))
  })

  it('supports basic options.', () => {
    const path = ImageUriBuilder.getPath({
      cid,
      format: 'png',
      height: 200,
      width: 300,
    })
    expect(path).toEqual(`/rs:fill:300:200:0:0/plain/${cid.toString()}@png`)
    expect(ImageUriBuilder.getOptions(path)).toEqual({
      cid,
      format: 'png',
      fit: 'cover',
      height: 200,
      width: 300,
      min: false,
    })
  })

  it('supports fit option.', () => {
    const path = ImageUriBuilder.getPath({
      cid,
      format: 'png',
      fit: 'inside',
      height: 200,
      width: 300,
    })
    expect(path).toEqual(`/rs:fit:300:200:0:0/plain/${cid.toString()}@png`)
    expect(ImageUriBuilder.getOptions(path)).toEqual({
      cid,
      format: 'png',
      fit: 'inside',
      height: 200,
      width: 300,
      min: false,
    })
  })

  it('supports min=true option.', () => {
    const path = ImageUriBuilder.getPath({
      cid,
      format: 'png',
      height: 200,
      width: 300,
      min: true,
    })
    expect(path).toEqual(`/rs:fill:300:200:1:0/plain/${cid.toString()}@png`)
    expect(ImageUriBuilder.getOptions(path)).toEqual({
      cid,
      format: 'png',
      fit: 'cover',
      height: 200,
      width: 300,
      min: true,
    })
  })

  it('supports min={height,width} option.', () => {
    const path = ImageUriBuilder.getPath({
      cid,
      format: 'jpeg',
      height: 200,
      width: 300,
      min: { height: 50, width: 100 },
    })
    expect(path).toEqual(
      `/rs:fill:300:200:0:0/mw:100/mh:50/plain/${cid.toString()}@jpeg`,
    )
    expect(ImageUriBuilder.getOptions(path)).toEqual({
      cid,
      format: 'jpeg',
      fit: 'cover',
      height: 200,
      width: 300,
      min: { height: 50, width: 100 },
    })
  })

  it('errors on bad cid/format part.', () => {
    expect(
      tryGetOptions(`/rs:fill:300:200:1:0/plain/${cid.toString()}@mp4`),
    ).toThrow(new BadPathError('Invalid path: bad cid/format part'))
    expect(tryGetOptions(`/rs:fill:300:200:1:0/plain/@jpg`)).toThrow(
      new BadPathError('Invalid path: bad cid/format part'),
    )
    expect(
      tryGetOptions(`/rs:fill:300:200:1:0/plain/${cid.toString()}@`),
    ).toThrow(new BadPathError('Invalid path: bad cid/format part'))
    expect(
      tryGetOptions(`/rs:fill:300:200:1:0/plain/${cid.toString()}@`),
    ).toThrow(new BadPathError('Invalid path: bad cid/format part'))
    expect(
      tryGetOptions(`/rs:fill:300:200:1:0/plain/${cid.toString()}@x@jpeg`),
    ).toThrow(new BadPathError('Invalid path: bad cid/format part'))
  })

  it('errors on mismatching min settings.', () => {
    expect(
      tryGetOptions(
        `/rs:fill:300:200:1:0/mw:100/mh:50/plain/${cid.toString()}@jpeg`,
      ),
    ).toThrow(new BadPathError('Invalid path: bad min width/height param'))
    expect(
      tryGetOptions(`/rs:fill:300:200:0:0/mw:100/plain/${cid.toString()}@jpeg`),
    ).toThrow(new BadPathError('Invalid path: bad min width/height param'))
  })

  it('errors on bad fit setting.', () => {
    expect(
      tryGetOptions(`/rs:blah:300:200:1:0/plain/${cid.toString()}@jpeg`),
    ).toThrow(new BadPathError('Invalid path: bad resize fit param'))
  })

  it('errors on bad dimension settings.', () => {
    expect(
      tryGetOptions(`/rs:fill:30x:200:1:0/plain/${cid.toString()}@jpeg`),
    ).toThrow(new BadPathError('Invalid path: bad resize height/width param'))
    expect(
      tryGetOptions(`/rs:fill:300:20x:1:0/plain/${cid.toString()}@jpeg`),
    ).toThrow(new BadPathError('Invalid path: bad resize height/width param'))
    expect(
      tryGetOptions(
        `/rs:fill:300:200:1:0/mw:10x/mh:50/plain/${cid.toString()}@jpeg`,
      ),
    ).toThrow(new BadPathError('Invalid path: bad min width/height param'))
    expect(
      tryGetOptions(
        `/rs:fill:300:200:1:0/mw:100/mh:5x/plain/${cid.toString()}@jpeg`,
      ),
    ).toThrow(new BadPathError('Invalid path: bad min width/height param'))
  })

  function tryGetOptions(path: string) {
    return () => ImageUriBuilder.getOptions(path)
  }
})
