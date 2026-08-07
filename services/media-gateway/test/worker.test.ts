import { describe, expect, it } from 'vitest'
import worker, { type Env } from '../src/index'

const did = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'
const cid = 'bafkreibm6jg3ux5qux2m7g5w4hfuaf2mp4xg6t4n2v5x6iiys5ndq4nohq'
const bytes = new TextEncoder().encode('0123456789')
const key = `blocks/${did}/${cid}`

type StoredObject = {
  bytes: Uint8Array
  contentType?: string
  etag: string
}

class TestBucket {
  constructor(private objects = new Map<string, StoredObject>()) {}

  async head(objectKey: string) {
    const object = this.objects.get(objectKey)
    return object ? metadata(object) : null
  }

  async get(
    objectKey: string,
    options?: { range?: { offset: number; length: number } },
  ) {
    const object = this.objects.get(objectKey)
    if (!object) return null
    const range = options?.range
    const body = range
      ? object.bytes.slice(range.offset, range.offset + range.length)
      : object.bytes
    return {
      ...metadata(object),
      body: new Blob([body]).stream(),
    }
  }
}

function metadata(object: StoredObject) {
  return {
    size: object.bytes.byteLength,
    httpEtag: `"${object.etag}"`,
    writeHttpMetadata(headers: Headers) {
      if (object.contentType) {
        headers.set('Content-Type', object.contentType)
      }
    },
  }
}

function env(withObject = true): Env {
  const objects = new Map<string, StoredObject>()
  if (withObject) {
    objects.set(key, {
      bytes,
      contentType: 'video/mp4',
      etag: 'object-etag',
    })
  }
  return { MEDIA: new TestBucket(objects) as unknown as R2Bucket }
}

function request(
  path = `/v1/media/${encodeURIComponent(did)}/${cid}`,
  init?: RequestInit,
) {
  return worker.fetch(new Request(`https://media.example${path}`, init), env())
}

describe('media gateway worker', () => {
  it('allows only GET, HEAD, and OPTIONS', async () => {
    const response = await request(undefined, { method: 'POST' })
    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET, HEAD, OPTIONS')

    const options = await request(undefined, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example' },
    })
    expect(options.status).toBe(204)
  })

  it.each([
    '/media/did%3Aplc%3Aabc/' + cid,
    '/v1/media/not-a-did/' + cid,
    '/v1/media/' + encodeURIComponent(did) + '/not-a-cid',
    '/v1/media/' + encodeURIComponent(did) + '/' + cid + '/extra',
    '/v1/media/' + encodeURIComponent('did:plc:bad/path') + '/' + cid,
    '/v1/media/' + encodeURIComponent('did:web:example.com%GG') + '/' + cid,
  ])('rejects invalid paths: %s', async (path) => {
    const response = await request(path)
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Invalid media path\n')
  })

  it('returns a stable response for a missing object', async () => {
    const response = await worker.fetch(
      new Request(
        `https://media.example/v1/media/${encodeURIComponent(did)}/${cid}`,
      ),
      env(false),
    )
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Media not found\n')
  })

  it('serves a complete GET with object metadata', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('0123456789')
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Length')).toBe('10')
    expect(response.headers.get('ETag')).toBe('"object-etag"')
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
  })

  it('sniffs image MIME when R2 has no content-type metadata', async () => {
    const png = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
    ])
    const objects = new Map<string, StoredObject>([
      [key, { bytes: png, etag: 'png-etag' }],
    ])
    const response = await worker.fetch(
      new Request(
        `https://media.example/v1/media/${encodeURIComponent(did)}/${cid}`,
      ),
      { MEDIA: new TestBucket(objects) as unknown as R2Bucket },
    )

    expect(response.headers.get('Content-Type')).toBe('image/png')
  })

  it('serves HEAD metadata without a body', async () => {
    const response = await request(undefined, { method: 'HEAD' })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Length')).toBe('10')
    expect(response.headers.get('ETag')).toBe('"object-etag"')
  })

  it.each([
    ['bytes=2-5', '2345', 'bytes 2-5/10'],
    ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'],
  ])('serves byte range %s', async (range, body, contentRange) => {
    const response = await request(undefined, { headers: { Range: range } })
    expect(response.status).toBe(206)
    expect(await response.text()).toBe(body)
    expect(response.headers.get('Content-Range')).toBe(contentRange)
    expect(response.headers.get('Content-Length')).toBe(String(body.length))
  })

  it.each(['bytes=10-', 'bytes=5-2', 'bytes=abc', 'bytes=0-1,4-5'])(
    'returns 416 for an unsatisfiable range: %s',
    async (range) => {
      const response = await request(undefined, { headers: { Range: range } })
      expect(response.status).toBe(416)
      expect(response.headers.get('Content-Range')).toBe('bytes */10')
    },
  )

  it('sets public cache and credential-free CORS headers', async () => {
    const response = await request(undefined, {
      headers: { Origin: 'https://app.example' },
    })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull()
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    )
  })

  it('serves mirrored HLS master playlists with the HLS MIME type', async () => {
    const master =
      '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nv540/index.m3u8\n'
    const hlsKey = `video/${did}/${cid}/master.m3u8`
    const objects = new Map<string, StoredObject>([
      [
        hlsKey,
        {
          bytes: new TextEncoder().encode(master),
          etag: 'hls-etag',
        },
      ],
    ])
    const response = await worker.fetch(
      new Request(
        `https://media.example/v1/hls/${encodeURIComponent(did)}/${cid}/master.m3u8`,
      ),
      { MEDIA: new TestBucket(objects) as unknown as R2Bucket },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.apple.mpegurl',
    )
    expect(await response.text()).toBe(master)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('serves HLS segments with video/mp2t', async () => {
    const segKey = `video/${did}/${cid}/v540/seg0.ts`
    const objects = new Map<string, StoredObject>([
      [
        segKey,
        {
          bytes: new Uint8Array([0, 1, 2, 3]),
          etag: 'seg-etag',
        },
      ],
    ])
    const response = await worker.fetch(
      new Request(
        `https://media.example/v1/hls/${encodeURIComponent(did)}/${cid}/v540/seg0.ts`,
      ),
      { MEDIA: new TestBucket(objects) as unknown as R2Bucket },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('video/mp2t')
  })

  it('rejects unsafe HLS asset paths', async () => {
    const response = await worker.fetch(
      new Request(
        `https://media.example/v1/hls/${encodeURIComponent(did)}/${cid}/../secret`,
      ),
      env(false),
    )
    expect(response.status).toBe(400)
  })
})
