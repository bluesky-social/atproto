import { CID } from 'multiformats/cid'
import { isValidDid } from '@atproto/syntax'

export interface Env {
  MEDIA: R2Bucket
}

const CACHE_CONTROL = 'public, max-age=31536000, immutable'
const ALLOWED_METHODS = 'GET, HEAD, OPTIONS'
const MEDIA_PATH = '/v1/media/'
const HLS_PATH = '/v1/hls/'
const HLS_MASTER_MIME = 'application/vnd.apple.mpegurl'
const HLS_SEGMENT_MIME = 'video/mp2t'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return response(null, 204, {
        Allow: ALLOWED_METHODS,
        'Access-Control-Allow-Headers': 'Range',
        'Access-Control-Allow-Methods': ALLOWED_METHODS,
        'Access-Control-Max-Age': '86400',
      })
    }

    const isReadMethod = request.method === 'GET' || request.method === 'HEAD'
    if (!isReadMethod) {
      return response('Method not allowed\n', 405, { Allow: ALLOWED_METHODS })
    }

    const pathname = new URL(request.url).pathname
    const media = parseMediaPath(pathname)
    const hls = media ? undefined : parseHlsPath(pathname)
    if (!media && !hls) {
      return response('Invalid media path\n', 400)
    }

    const key = media
      ? `blocks/${media.did}/${media.cid}`
      : `video/${hls!.did}/${hls!.cid}/${hls!.assetPath}`

    const object = await env.MEDIA.head(key)
    if (!object) {
      return response('Media not found\n', 404)
    }

    const requestedRange = request.headers.get('Range')
    const range = requestedRange
      ? parseRange(requestedRange, object.size)
      : undefined
    if (requestedRange && !range) {
      return response('Range not satisfiable\n', 416, {
        'Content-Range': `bytes */${object.size}`,
      })
    }

    const headers = await objectHeaders(env.MEDIA, key, object, hls?.assetPath)
    let status = 200
    if (range) {
      status = 206
      headers.set(
        'Content-Range',
        `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`,
      )
      headers.set('Content-Length', String(range.length))
    }

    if (request.method === 'HEAD') {
      return response(null, status, headers)
    }

    const body = await env.MEDIA.get(
      key,
      range ? { range: { offset: range.offset, length: range.length } } : {},
    )
    if (!body) {
      return response('Media not found\n', 404)
    }

    return response(body.body, status, headers)
  },
}

function parseMediaPath(
  pathname: string,
): { did: string; cid: string } | undefined {
  if (!pathname.startsWith(MEDIA_PATH)) return
  const parts = pathname.slice(MEDIA_PATH.length).split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return

  let did: string
  let cid: string
  try {
    did = decodeURIComponent(parts[0])
    cid = decodeURIComponent(parts[1])
  } catch {
    return
  }

  if (!isStrictDid(did) || !isCanonicalCid(cid)) return
  return { did, cid }
}

function parseHlsPath(
  pathname: string,
): { did: string; cid: string; assetPath: string } | undefined {
  if (!pathname.startsWith(HLS_PATH)) return
  const parts = pathname.slice(HLS_PATH.length).split('/')
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return

  let did: string
  let cid: string
  try {
    did = decodeURIComponent(parts[0])
    cid = decodeURIComponent(parts[1])
  } catch {
    return
  }
  if (!isStrictDid(did) || !isCanonicalCid(cid)) return

  const assetParts = parts.slice(2)
  if (assetParts.some((part) => !part || part === '.' || part === '..')) return
  const assetPath = assetParts.join('/')
  if (!isSafeHlsAssetPath(assetPath)) return
  return { did, cid, assetPath }
}

function isSafeHlsAssetPath(assetPath: string): boolean {
  if (assetPath.length > 512) return false
  return /^(master\.m3u8|poster\.jpg|status\.json|v\d+\/(index\.m3u8|seg\d+\.ts))$/.test(
    assetPath,
  )
}

function isStrictDid(value: string): boolean {
  if (!isValidDid(value)) return false
  for (
    let index = value.indexOf('%');
    index !== -1;
    index = value.indexOf('%', index + 1)
  ) {
    if (!/^[0-9A-Fa-f]{2}$/.test(value.slice(index + 1, index + 3)))
      return false
  }
  return true
}

function isCanonicalCid(value: string): boolean {
  if (value.length > 256) return false
  try {
    return CID.parse(value).toString() === value
  } catch {
    return false
  }
}

function parseRange(
  header: string,
  size: number,
): { offset: number; length: number } | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (!match[1] && !match[2]) || size === 0) return

  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return
    const length = Math.min(suffixLength, size)
    return { offset: size - length, length }
  }

  const offset = Number(match[1])
  if (!Number.isSafeInteger(offset) || offset >= size) return
  const requestedEnd = match[2] ? Number(match[2]) : size - 1
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < offset) return
  const end = Math.min(requestedEnd, size - 1)
  return { offset, length: end - offset + 1 }
}

async function objectHeaders(
  bucket: R2Bucket,
  key: string,
  object: R2Object,
  hlsAssetPath?: string,
): Promise<Headers> {
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  if (hlsAssetPath) {
    // Prefer correct HLS MIME even if R2 metadata is wrong/missing.
    headers.set('Content-Type', contentTypeForHlsAsset(hlsAssetPath))
  } else if (isGenericContentType(headers.get('Content-Type'))) {
    // PDS/S3 uploads often store application/octet-stream; sniff real MIME.
    headers.set(
      'Content-Type',
      await sniffObjectContentType(bucket, key, object),
    )
  }
  headers.set('Content-Length', String(object.size))
  headers.set('ETag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', CACHE_CONTROL)
  return headers
}

function isGenericContentType(contentType: string | null): boolean {
  if (!contentType) return true
  return (
    contentType.split(';')[0].trim().toLowerCase() ===
    'application/octet-stream'
  )
}

function contentTypeForHlsAsset(assetPath: string): string {
  if (assetPath.endsWith('.m3u8')) return HLS_MASTER_MIME
  if (assetPath.endsWith('.ts')) return HLS_SEGMENT_MIME
  if (assetPath.endsWith('.jpg')) return 'image/jpeg'
  if (assetPath.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

async function sniffObjectContentType(
  bucket: R2Bucket,
  key: string,
  object: R2Object,
): Promise<string> {
  if (object.size === 0) return 'application/octet-stream'
  const sample = await bucket.get(key, {
    range: { offset: 0, length: Math.min(object.size, 16) },
  })
  if (!sample) return 'application/octet-stream'
  const bytes = new Uint8Array(await new Response(sample.body).arrayBuffer())

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(bytes, 0, 6))) {
    return 'image/gif'
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    return 'video/mp4'
  }
  return 'application/octet-stream'
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end))
}

function response(
  body: BodyInit | null,
  status: number,
  headersInit?: HeadersInit,
): Response {
  const headers = new Headers(headersInit)
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(body, { status, headers })
}
