import type stream from 'node:stream'

/**
 * Resolve Content-Type for S3/R2 blob uploads.
 * Prefer an explicit mime from the PDS upload path; otherwise sniff magic bytes
 * when the body is already buffered.
 */
export function resolveUploadContentType(
  bytes: Uint8Array | stream.Readable,
  explicit?: string,
): string | undefined {
  const trimmed = explicit?.split(';')[0]?.trim()
  if (trimmed && trimmed.toLowerCase() !== 'application/octet-stream') {
    return trimmed
  }
  if (bytes instanceof Uint8Array) {
    return sniffContentTypeFromBytes(bytes) ?? trimmed
  }
  return trimmed
}

export function sniffContentTypeFromBytes(
  bytes: Uint8Array,
): string | undefined {
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
  return undefined
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end))
}
