const PDS_URL = process.env.PDS_URL ?? 'http://localhost:3000'

// Unique suffix per run so handles never collide across test runs
const suffix = Date.now().toString(36)

type JsonBody = Record<string, unknown>

async function xrpcPost(
  nsid: string,
  body: JsonBody,
  jwt?: string,
): Promise<JsonBody> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`
  const res = await fetch(`${PDS_URL}/xrpc/${nsid}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${nsid} failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<JsonBody>
}

async function xrpcGet(
  nsid: string,
  params: Record<string, string>,
  jwt?: string,
): Promise<JsonBody> {
  const qs = new URLSearchParams(params).toString()
  const headers: Record<string, string> = {}
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`
  const res = await fetch(`${PDS_URL}/xrpc/${nsid}?${qs}`, { headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET ${nsid} failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<JsonBody>
}

async function uploadBlob(blob: Buffer, jwt: string): Promise<JsonBody> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/octet-stream',
  }
  const res = await fetch(`${PDS_URL}/xrpc/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers,
    body: blob,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`uploadBlob failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<JsonBody>
}

async function getBlob(did: string, cid: string): Promise<Buffer> {
  const res = await fetch(
    `${PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`,
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`getBlob failed ${res.status}: ${text}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

describe('PDS + PLC integration', () => {
  let did: string
  let jwt: string
  let postUri: string
  let postCid: string
  let blobCid: string

  const handle = `testuser${suffix}.test`
  const email = `testuser${suffix}@example.com`
  const password = 'hunter2-integration-test'

  // ─── create_user ────────────────────────────────────────────────────────────

  it('create_user — registers a new account', async () => {
    const data = await xrpcPost('com.atproto.server.createAccount', {
      handle,
      email,
      password,
    })
    expect(typeof data.did).toBe('string')
    expect((data.did as string).startsWith('did:')).toBe(true)
    expect(data.handle).toBe(handle)
    expect(typeof data.accessJwt).toBe('string')

    did = data.did as string
    jwt = data.accessJwt as string
  })

  // ─── make_post ──────────────────────────────────────────────────────────────

  it('make_post — creates a feed post record', async () => {
    const data = await xrpcPost(
      'com.atproto.repo.createRecord',
      {
        repo: did,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: `Hello from integration test! (${suffix})`,
          createdAt: new Date().toISOString(),
        },
      },
      jwt,
    )
    expect(typeof data.uri).toBe('string')
    expect((data.uri as string).startsWith('at://')).toBe(true)
    expect(typeof data.cid).toBe('string')

    postUri = data.uri as string
    postCid = data.cid as string
  })

  // ─── get_post ───────────────────────────────────────────────────────────────

  it('get_post — retrieves the exact record by AT URI', async () => {
    // AT URI format: at://did/collection/rkey
    const [repoDid, collection, rkey] = postUri.replace('at://', '').split('/')

    const data = await xrpcGet(
      'com.atproto.repo.getRecord',
      { repo: repoDid, collection, rkey },
      jwt,
    )
    expect(data.uri).toBe(postUri)
    expect(data.cid).toBe(postCid)
    expect((data.value as { text: string }).text).toBe(
      `Hello from integration test! (${suffix})`,
    )
  })

  // ─── get_user ───────────────────────────────────────────────────────────────

  it('get_user — describes the repo and confirms handle + collections', async () => {
    const data = await xrpcGet(
      'com.atproto.repo.describeRepo',
      { repo: did },
      jwt,
    )
    expect(data.did).toBe(did)
    expect(data.handle).toBe(handle)
    expect(data.collections as string[]).toContain('app.bsky.feed.post')
  })

  // ─── get_user_feed ──────────────────────────────────────────────────────────
  // No AppView running, so we use listRecords directly on the PDS repo.

  it('get_user_feed — lists posts in the user repo', async () => {
    const data = await xrpcGet(
      'com.atproto.repo.listRecords',
      { repo: did, collection: 'app.bsky.feed.post' },
      jwt,
    )
    const records = data.records as Array<{ uri: string; cid: string }>
    expect(records.length).toBeGreaterThanOrEqual(1)

    const match = records.find((r) => r.uri === postUri)
    expect(match).toBeDefined()
    expect(match?.cid).toBe(postCid)
  })

  // ─── upload_blob ─────────────────────────────────────────────────────────────

  it('upload_blob — uploads a binary blob and returns a CID', async () => {
    const payload = Buffer.from(`blob-content-${suffix}`)
    const data = await uploadBlob(payload, jwt)

    // Response shape: { blob: { $type, ref: { $link }, mimeType, size } }
    const blob = data.blob as {
      $type: string
      ref: { $link: string }
      mimeType: string
      size: number
    }
    expect(blob.$type).toBe('blob')
    expect(typeof blob.ref.$link).toBe('string')
    expect(blob.ref.$link.length).toBeGreaterThan(0)
    expect(blob.mimeType).toBe('application/octet-stream')
    expect(blob.size).toBe(payload.byteLength)

    blobCid = blob.ref.$link

    // Blobs live in temporary storage until referenced by a committed record.
    // com.atproto.sync.getBlob only serves committed blobs, so we must create
    // a record that contains the blob ref before the get_blob test can succeed.
    await xrpcPost(
      'com.atproto.repo.createRecord',
      {
        repo: did,
        collection: 'app.sokaa.test.blob',
        record: {
          $type: 'app.sokaa.test.blob',
          blob: {
            $type: 'blob',
            ref: { $link: blobCid },
            mimeType: 'application/octet-stream',
            size: payload.byteLength,
          },
        },
      },
      jwt,
    )
  })

  // ─── get_blob ────────────────────────────────────────────────────────────────

  it('get_blob — retrieves the uploaded blob bytes by DID + CID', async () => {
    const payload = Buffer.from(`blob-content-${suffix}`)
    const returned = await getBlob(did, blobCid)

    expect(returned.byteLength).toBe(payload.byteLength)
    expect(returned.equals(payload)).toBe(true)
  })
})
