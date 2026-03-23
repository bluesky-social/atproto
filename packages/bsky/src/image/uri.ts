import { FeatureGatesClient } from '../feature-gates'
import { Options } from './util'

// @NOTE if there are any additions here, ensure to include them on ImageUriBuilder.presets
export type ImagePreset =
  | 'avatar'
  | 'banner'
  | 'feed_thumbnail'
  | 'feed_fullsize'

const PATH_REGEX = /^\/(.+?)\/plain\/(.+?)\/(.+?)(?:@(.+?))?$/

export class ImageUriBuilder {
  constructor(public endpoint: string) {}

  static presets: ImagePreset[] = [
    'avatar',
    'banner',
    'feed_thumbnail',
    'feed_fullsize',
  ]

  getPresetUri(
    id: ImagePreset,
    did: string,
    cid: string,
    featureGatesClient?: FeatureGatesClient,
  ): string {
    const options = presets[id]
    if (!options) {
      throw new Error(`Unrecognized requested common uri type: ${id}`)
    }

    // TODO: Remove after image migration. It is not ideal to check feature gates outside of handlers with the current setup..
    const map = featureGatesClient?.checkGates(
      ['image:remove_format_from_url'],
      {
        // This is a workaround. We're trying to use the image owner's DID as if it were the viewer,
        // while in reality it is the owner of the subject (image) being viewed.
        // My expectation is that it does the effect of, instead of rolling out gradually by the image viewers,
        // that it rolls out gradually by the image owners.
        viewer: did,
      },
    )
    const removeFormat = map?.get('image:remove_format_from_url') ?? false
    const includeFormat = !removeFormat

    return (
      this.endpoint +
      ImageUriBuilder.getPath({
        preset: id,
        did,
        cid,
        includeFormat,
      })
    )
  }

  static getPath(
    opts: { preset: ImagePreset } & BlobLocation & {
        includeFormat?: boolean
      },
  ) {
    const { format } = presets[opts.preset]
    return (
      `/${opts.preset}/plain/${opts.did}/${opts.cid}` +
      (opts.includeFormat ? `@${format}` : '')
    )
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
    if (
      formatUnsafe !== undefined &&
      formatUnsafe !== 'jpeg' &&
      formatUnsafe !== 'webp'
    ) {
      throw new BadPathError('Invalid path: bad format')
    }
    const preset = presetUnsafe as ImagePreset
    const format = formatUnsafe as Options['format']
    return {
      ...presets[preset],
      format: format ?? presets[preset].format,
      did,
      cid,
      preset,
    }
  }
}

type BlobLocation = { cid: string; did: string }

export class BadPathError extends Error {}

export const presets: Record<ImagePreset, Options> = {
  avatar: {
    format: 'jpeg', // @TODO switch these formats to webp after rollout
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
