import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import {
  resolveUploadContentType,
  sniffContentTypeFromBytes,
} from './content-type'

describe('sniffContentTypeFromBytes', () => {
  it('detects PNG magic bytes', () => {
    const png = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
    ])
    expect(sniffContentTypeFromBytes(png)).toBe('image/png')
  })

  it('detects JPEG magic bytes', () => {
    expect(sniffContentTypeFromBytes(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(
      'image/jpeg',
    )
  })

  it('returns undefined for unknown payloads', () => {
    expect(sniffContentTypeFromBytes(Uint8Array.from([1, 2, 3, 4]))).toBe(
      undefined,
    )
  })
})

describe('resolveUploadContentType', () => {
  const png = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  ])

  it('prefers an explicit specific mime over sniffing', () => {
    expect(resolveUploadContentType(png, 'image/jpeg')).toBe('image/jpeg')
  })

  it('sniffs when explicit mime is missing', () => {
    expect(resolveUploadContentType(png)).toBe('image/png')
  })

  it('sniffs when explicit mime is application/octet-stream', () => {
    expect(resolveUploadContentType(png, 'application/octet-stream')).toBe(
      'image/png',
    )
  })

  it('keeps octet-stream for streams when sniffing is unavailable', () => {
    expect(
      resolveUploadContentType(Readable.from([]), 'application/octet-stream'),
    ).toBe('application/octet-stream')
  })
})
