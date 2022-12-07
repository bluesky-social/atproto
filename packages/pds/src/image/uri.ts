import { createHmac } from 'crypto'
import * as uint8arrays from 'uint8arrays'
import { Options } from './util'

export class ImageUriBuilder {
  constructor(public salt: Uint8Array, public key: Uint8Array) {}

  getSignedPath(opts: Options & { fileId: string }) {
    const path = ImageUriBuilder.getPath(opts)
    const saltedPath = uint8arrays.concat([
      this.salt,
      uint8arrays.fromString(path),
    ])
    const sig = hmac(this.key, saltedPath).toString('base64url')
    return `/${sig}${path}`
  }

  getVerifiedOptions(
    path: string,
  ): Options & { fileId: string; signature: string } {
    if (path.at(0) !== '/') {
      throw new BadPathError('Invalid path: does not start with a slash')
    }
    const pathParts = path.split('/') // ['', sig, 'rs:fill:...', ...]
    const [sig] = pathParts.splice(1, 1) // ['', 'rs:fill:...', ...]
    const unsignedPath = pathParts.join('/')
    if (!sig || sig.includes(':')) {
      throw new BadPathError('Invalid path: missing signature')
    }
    const saltedPath = uint8arrays.concat([
      this.salt,
      uint8arrays.fromString(unsignedPath),
    ])
    const validSig = hmac(this.key, saltedPath).toString('base64url')
    if (sig !== validSig) {
      throw new BadPathError('Invalid path: bad signature')
    }
    const options = ImageUriBuilder.getOptions(unsignedPath)
    return {
      signature: validSig,
      ...options,
    }
  }

  static getPath(opts: Options & { fileId: string }) {
    const fit = opts.fit === 'inside' ? 'fit' : 'fill' // fit default is 'cover'
    const enlarge = opts.min === true ? 1 : 0 // min default is false
    const resize = `rs:${fit}:${opts.width}:${opts.height}:${enlarge}:0` // final ':0' is for interop with imgproxy
    const minWidth =
      opts.min && typeof opts.min === 'object' ? `mw:${opts.min.width}` : null
    const minHeight =
      opts.min && typeof opts.min === 'object' ? `mh:${opts.min.height}` : null
    const enc = encodeURIComponent
    return (
      `/` +
      [resize, minWidth, minHeight].filter(Boolean).join('/') +
      `/plain/${enc(opts.fileId)}@${opts.format}`
    )
  }

  static getOptions(path: string): Options & { fileId: string } {
    if (path.at(0) !== '/') {
      throw new BadPathError('Invalid path: does not start with a slash')
    }
    const parts = path.split('/')
    if (parts.at(-2) !== 'plain') {
      throw new BadPathError('Invalid path')
    }
    const fileIdAndFormat = parts.at(-1)
    const [fileId, format, ...others] = fileIdAndFormat?.split('@') ?? []
    if (!fileId || (format !== 'png' && format !== 'jpeg') || others.length) {
      throw new BadPathError('Invalid path: bad fileId/format part')
    }
    const resizePart = parts.find((part) => part.startsWith('rs:'))
    const minWidthPart = parts.find((part) => part.startsWith('mw:'))
    const minHeightPart = parts.find((part) => part.startsWith('mh:'))
    const [, fit, width, height, enlarge] = resizePart?.split(':') ?? []
    const [, minWidth] = minWidthPart?.split(':') ?? []
    const [, minHeight] = minHeightPart?.split(':') ?? []
    if (fit !== 'fill' && fit !== 'fit') {
      throw new BadPathError('Invalid path: bad resize fit param')
    }
    if (isNaN(toInt(width)) || isNaN(toInt(height))) {
      throw new BadPathError('Invalid path: bad resize height/width param')
    }
    if (enlarge !== '0' && enlarge !== '1') {
      throw new BadPathError('Invalid path: bad resize enlarge param')
    }
    if (
      (!minWidth && minHeight) ||
      (minWidth && !minHeight) ||
      (minWidth && isNaN(toInt(minWidth))) ||
      (minHeight && isNaN(toInt(minHeight))) ||
      (enlarge === '1' && (minHeight || minHeight))
    ) {
      throw new BadPathError('Invalid path: bad min width/height param')
    }
    const dec = decodeURIComponent
    return {
      fileId: dec(fileId),
      format,
      height: toInt(height),
      width: toInt(width),
      fit: fit === 'fill' ? 'cover' : 'inside',
      min:
        minWidth && minHeight
          ? { width: toInt(minWidth), height: toInt(minHeight) }
          : enlarge === '1',
    }
  }
}

export class BadPathError extends Error {}

function toInt(str: string) {
  if (!/^\d+$/.test(str)) {
    return NaN // String must be all numeric
  }
  return parseInt(str, 10)
}

function hmac(key: Uint8Array, message: Uint8Array) {
  return createHmac('sha256', key).update(message).digest()
}
