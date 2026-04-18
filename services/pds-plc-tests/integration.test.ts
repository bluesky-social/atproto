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

describe('PDS + PLC integration', () => {
  let did: string
  let jwt: string
  let postUri: string
  let postCid: string

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
})
