import * as uint8arrays from 'uint8arrays'
import { ImageUriBuilder, BadPathError } from '../../src/image/uri'

describe('image uri builder', () => {
  let uriBuilder: ImageUriBuilder

  beforeAll(() => {
    const b64Bytes = (b64: string) => uint8arrays.fromString(b64, 'base64')
    const salt = b64Bytes('ndBCIfV1W85fVfR0ZMJ+Hg==')
    const key = b64Bytes('8j7NFCg1Al9Cw9ss8l3YE5VsF4OSdgJWIR+dMV+KtNg=')
    uriBuilder = new ImageUriBuilder(salt, key)
  })

  it('signs and verifies uri options.', () => {
    const path = uriBuilder.getSignedPath({
      fileId: 'dd180f3',
      format: 'png',
      height: 200,
      width: 300,
    })
    expect(path).toEqual(
      '/BtHM_4IOak5MOc2gOPDxbfS4_HG6VPcry2OAV03L29g/rs:fill:300:200:0:0/plain/dd180f3@png',
    )
    expect(uriBuilder.getVerifiedOptions(path)).toEqual({
      signature: 'BtHM_4IOak5MOc2gOPDxbfS4_HG6VPcry2OAV03L29g',
      fileId: 'dd180f3',
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
      '/BtHM_4IOak5MOc2gOPDxbfS4_HG6VPcry2OAV03L29g/rs:fill:300:200:0:0/plain/dd180f3@png',
    )

    expect(
      tryGetVerifiedOptions(
        // Tamper with signature
        '/DtHM_4IOak5MOc2gOPDxbfS4_HG6VPcry2OAV03L29g/rs:fill:300:200:0:0/plain/dd180f3@png',
      ),
    ).toThrow(new BadPathError('Invalid path: bad signature'))

    expect(
      tryGetVerifiedOptions(
        // Tamper with params
        '/DtHM_4IOak5MOc2gOPDxbfS4_HG6VPcry2OAV03L29g/rs:fill:300:200:0:0/plain/dd180f3@jpeg',
      ),
    ).toThrow(new BadPathError('Invalid path: bad signature'))

    expect(
      tryGetVerifiedOptions(
        // Missing signature
        '/rs:fill:300:200:0:0/plain/dd180f3@jpeg',
      ),
    ).toThrow(new BadPathError('Invalid path: missing signature'))
  })

  it('supports basic options.', () => {
    const path = ImageUriBuilder.getPath({
      fileId: 'dd180f3',
      format: 'png',
      height: 200,
      width: 300,
    })
    expect(path).toEqual('/rs:fill:300:200:0:0/plain/dd180f3@png')
    expect(ImageUriBuilder.getOptions(path)).toEqual({
      fileId: 'dd180f3',
      format: 'png',
      fit: 'cover',
      height: 200,
      width: 300,
      min: false,
    })
  })

  it('supports fit option.', () => {
    const path = ImageUriBuilder.getPath({
      fileId: 'dd180f3',
      format: 'png',
      fit: 'inside',
      height: 200,
      width: 300,
    })
    expect(path).toEqual('/rs:fit:300:200:0:0/plain/dd180f3@png')
    expect(ImageUriBuilder.getOptions(path)).toEqual({
      fileId: 'dd180f3',
      format: 'png',
      fit: 'inside',
      height: 200,
      width: 300,
      min: false,
    })
  })

  it('supports min=true option.', () => {
    const path = ImageUriBuilder.getPath({
      fileId: 'dd180f3',
      format: 'png',
      height: 200,
      width: 300,
      min: true,
    })
    expect(path).toEqual('/rs:fill:300:200:1:0/plain/dd180f3@png')
    expect(ImageUriBuilder.getOptions(path)).toEqual({
      fileId: 'dd180f3',
      format: 'png',
      fit: 'cover',
      height: 200,
      width: 300,
      min: true,
    })
  })

  it('supports min={height,width} option.', () => {
    const path = ImageUriBuilder.getPath({
      fileId: 'dd180f3',
      format: 'jpeg',
      height: 200,
      width: 300,
      min: { height: 50, width: 100 },
    })
    expect(path).toEqual('/rs:fill:300:200:0:0/mw:100/mh:50/plain/dd180f3@jpeg')
    expect(ImageUriBuilder.getOptions(path)).toEqual({
      fileId: 'dd180f3',
      format: 'jpeg',
      fit: 'cover',
      height: 200,
      width: 300,
      min: { height: 50, width: 100 },
    })
  })

  it('supports encoded fileId.', () => {
    const path = ImageUriBuilder.getPath({
      fileId: 'has space',
      format: 'jpeg',
      height: 200,
      width: 300,
    })
    expect(path).toEqual('/rs:fill:300:200:0:0/plain/has%20space@jpeg')
    expect(ImageUriBuilder.getOptions(path)).toEqual({
      fileId: 'has space',
      format: 'jpeg',
      fit: 'cover',
      height: 200,
      width: 300,
      min: false,
    })
  })

  it('errors on bad fileId/format part.', () => {
    expect(tryGetOptions('/rs:fill:300:200:1:0/plain/dd180f3@mp4')).toThrow(
      new BadPathError('Invalid path: bad fileId/format part'),
    )
    expect(tryGetOptions('/rs:fill:300:200:1:0/plain/@jpg')).toThrow(
      new BadPathError('Invalid path: bad fileId/format part'),
    )
    expect(tryGetOptions('/rs:fill:300:200:1:0/plain/dd180f3@')).toThrow(
      new BadPathError('Invalid path: bad fileId/format part'),
    )
    expect(tryGetOptions('/rs:fill:300:200:1:0/plain/dd180f3@')).toThrow(
      new BadPathError('Invalid path: bad fileId/format part'),
    )
    expect(tryGetOptions('/rs:fill:300:200:1:0/plain/dd180f3@x@jpeg')).toThrow(
      new BadPathError('Invalid path: bad fileId/format part'),
    )
  })

  it('errors on mismatching min settings.', () => {
    expect(
      tryGetOptions('/rs:fill:300:200:1:0/mw:100/mh:50/plain/dd180f3@jpeg'),
    ).toThrow(new BadPathError('Invalid path: bad min width/height param'))
    expect(
      tryGetOptions('/rs:fill:300:200:0:0/mw:100/plain/dd180f3@jpeg'),
    ).toThrow(new BadPathError('Invalid path: bad min width/height param'))
  })

  it('errors on bad fit setting.', () => {
    expect(tryGetOptions('/rs:blah:300:200:1:0/plain/dd180f3@jpeg')).toThrow(
      new BadPathError('Invalid path: bad resize fit param'),
    )
  })

  it('errors on bad dimension settings.', () => {
    expect(tryGetOptions('/rs:fill:30x:200:1:0/plain/dd180f3@jpeg')).toThrow(
      new BadPathError('Invalid path: bad resize height/width param'),
    )
    expect(tryGetOptions('/rs:fill:300:20x:1:0/plain/dd180f3@jpeg')).toThrow(
      new BadPathError('Invalid path: bad resize height/width param'),
    )
    expect(
      tryGetOptions('/rs:fill:300:200:1:0/mw:10x/mh:50/plain/dd180f3@jpeg'),
    ).toThrow(new BadPathError('Invalid path: bad min width/height param'))
    expect(
      tryGetOptions('/rs:fill:300:200:1:0/mw:100/mh:5x/plain/dd180f3@jpeg'),
    ).toThrow(new BadPathError('Invalid path: bad min width/height param'))
  })

  function tryGetOptions(path: string) {
    return () => ImageUriBuilder.getOptions(path)
  }
})
