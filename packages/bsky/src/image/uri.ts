import { Options } from './util'

// @NOTE if there are any additions here, ensure to include them on ImageUriBuilder.presets
export type ImagePreset =
  | 'avatar'
  | 'banner'
  | 'feed_thumbnail'
  | 'feed_fullsize'

const PATH_REGEX = /^\/(.+?)\/plain\/(.+?)\/(.+?)@(.+?)$/

export class ImageUriBuilder {
  constructor(public endpoint: string) {}

  static presets: ImagePreset[] = [
    'avatar',
    'banner',
    'feed_thumbnail',
    'feed_fullsize',
  ]

  getPresetUri(id: ImagePreset, did: string, cid: string): string {
    const options = presets[id]
    if (!options) {
      throw new Error(`Unrecognized requested common uri type: ${id}`)
    }
    return (
      this.endpoint +
      ImageUriBuilder.getPath({
        preset: id,
        did,
        cid,
      })
    )
  }

  static getPath(opts: { preset: ImagePreset } & BlobLocation) {
    const { format } = presets[opts.preset]
    return `/${opts.preset}/plain/${opts.did}/${opts.cid}@${format}`
  }

  static getOptions(
    path: string,
  ): Options & BlobLocation & { preset: ImagePreset } {
    const match = path.match(PATH_REGEX)
    if (!match) {
      throw new BadPathError('Invalid path')
    }
    const [, presetUnsafe, did, cid, formatUnsafe] = match
    if (!(ImageUriBuilder.presets as string[]).includes(presetUnsafe)) {
      throw new BadPathError('Invalid path: bad preset')
    }
    if (formatUnsafe !== 'jpeg' && formatUnsafe !== 'png') {
      throw new BadPathError('Invalid path: bad format')
    }
    const preset = presetUnsafe as ImagePreset
    const format = formatUnsafe as Options['format']
    return {
      ...presets[preset],
      did,
      cid,
      preset,
      format,
    }
  }
}

type BlobLocation = { cid: string; did: string }

export class BadPathError extends Error {}

export const presets: Record<ImagePreset, Options> = {
  avatar: {
    format: 'jpeg',
    fit: 'cover',
    height: 1000,
    width: 1000,
    min: true,
  },
  banner: {
    format: 'jpeg',
    fit: 'cover',
    height: 1000,
    width: 3000,
    min: true,
  },
  feed_thumbnail: {
    format: 'jpeg',
    fit: 'inside',
    height: 2000,
    width: 2000,
    min: true,
  },
  feed_fullsize: {
    format: 'jpeg',
    fit: 'inside',
    height: 1000,
    width: 1000,
    min: true,
  },
}
