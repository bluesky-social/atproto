import type { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { parseHttpRequest } from './stream.js'

// Bodies are bounded at two layers: `content-length` bounds the wire size, and
// a MaxSizeChecker bounds the decoded size. The cases below cross those bounds
// independently — a small gzip body that decodes past the limit, an oversized
// identity body, an oversized `content-length` — since neither bound implies
// the other.

const asRequest = (body: Buffer, headers: Record<string, string>) => {
  const req = Readable.from([body]) as unknown as IncomingMessage
  req.headers = headers
  return req
}

describe('parseHttpRequest', () => {
  it('parses a normal json payload.', async () => {
    const body = Buffer.from(JSON.stringify({ hello: 'world' }))
    const req = asRequest(body, { 'content-type': 'application/json' })
    await expect(parseHttpRequest(req, ['json'])).resolves.toEqual({
      hello: 'world',
    })
  })

  it('parses a normal urlencoded payload.', async () => {
    const body = Buffer.from('hello=world')
    const req = asRequest(body, {
      'content-type': 'application/x-www-form-urlencoded',
    })
    await expect(parseHttpRequest(req, ['urlencoded'])).resolves.toEqual({
      hello: 'world',
    })
  })

  it('rejects a body whose decoded size exceeds the limit.', async () => {
    const raw = Buffer.alloc(4096, 'A')
    const req = asRequest(gzipSync(raw), {
      'content-type': 'application/json',
      'content-encoding': 'gzip',
    })
    await expect(parseHttpRequest(req, ['json'], 1024)).rejects.toMatchObject({
      status: 413,
    })
  })

  it('rejects an oversized body that is not compressed.', async () => {
    const req = asRequest(Buffer.alloc(4096, 'A'), {
      'content-type': 'application/json',
    })
    await expect(parseHttpRequest(req, ['json'], 1024)).rejects.toMatchObject({
      status: 413,
    })
  })

  it('rejects an oversized content-length without reading the body.', async () => {
    let consumed = false
    const req = Readable.from(
      (function* () {
        consumed = true
        yield Buffer.alloc(2048, 'A')
      })(),
    ) as unknown as IncomingMessage
    req.headers = {
      'content-type': 'application/json',
      'content-length': '2048',
    }
    await expect(parseHttpRequest(req, ['json'], 1024)).rejects.toMatchObject({
      status: 413,
    })
    expect(consumed).toBe(false)
  })

  it('accepts a body whose content-length is within the limit.', async () => {
    const body = Buffer.from(JSON.stringify({ hello: 'world' }))
    const req = asRequest(body, {
      'content-type': 'application/json',
      'content-length': String(body.byteLength),
    })
    await expect(parseHttpRequest(req, ['json'], 1024)).resolves.toEqual({
      hello: 'world',
    })
  })

  it('rejects a malformed content-length.', async () => {
    const req = asRequest(Buffer.from('{}'), {
      'content-type': 'application/json',
      'content-length': 'many',
    })
    await expect(parseHttpRequest(req, ['json'])).rejects.toMatchObject({
      status: 400,
    })
  })

  it('rejects an unsupported content-encoding.', async () => {
    const req = asRequest(Buffer.from(JSON.stringify({ hello: 'world' })), {
      'content-type': 'application/json',
      'content-encoding': 'bogus',
    })
    await expect(parseHttpRequest(req, ['json'])).rejects.toMatchObject({
      status: 415,
    })
  })
})
