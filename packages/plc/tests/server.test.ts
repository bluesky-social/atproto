import { EcdsaKeypair } from '@atproto/crypto'
import PlcClient from '../src/client'
import * as document from '../src/lib/document'
import { CloseFn, runTestServer } from './_util'
import { cidForData } from '@atproto/common'
import { AxiosError } from 'axios'
import { App } from '../src'
import * as locals from '../src/server/locals'

describe('PLC server', () => {
  let handle = 'alice.example.com'
  let atpPds = 'example.com'

  let app: App
  let close: CloseFn
  let client: PlcClient

  let signingKey: EcdsaKeypair
  let recoveryKey: EcdsaKeypair

  let did: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'server',
    })

    app = server.app
    close = server.close
    client = new PlcClient(server.url)
    signingKey = await EcdsaKeypair.create()
    recoveryKey = await EcdsaKeypair.create()
  })

  afterAll(async () => {
    if (close) {
      await close()
    }
  })

  it('registers a did', async () => {
    did = await client.createDid(signingKey, recoveryKey.did(), handle, atpPds)
  })

  it('retrieves did doc data', async () => {
    const doc = await client.getDocumentData(did)
    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.handle).toEqual(handle)
    expect(doc.atpPds).toEqual(atpPds)
  })

  it('can perform some updates', async () => {
    const newSigningKey = await EcdsaKeypair.create()
    const newRecoveryKey = await EcdsaKeypair.create()

    await client.rotateSigningKey(did, newSigningKey.did(), signingKey)
    signingKey = newSigningKey

    await client.rotateRecoveryKey(did, newRecoveryKey.did(), signingKey)
    recoveryKey = newRecoveryKey

    handle = 'ali.example2.com'
    await client.updateHandle(did, handle, signingKey)

    atpPds = 'example2.com'
    await client.updateAtpPds(did, atpPds, signingKey)

    const doc = await client.getDocumentData(did)
    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.handle).toEqual(handle)
    expect(doc.atpPds).toEqual(atpPds)
  })

  it('does not allow key types that we do not support', async () => {
    // an ed25519 key which we don't yet support
    const newSigningKey =
      'did:key:z6MkjwbBXZnFqL8su24wGL2Fdjti6GSLv9SWdYGswfazUPm9'

    const promise = client.rotateSigningKey(did, newSigningKey, signingKey)
    await expect(promise).rejects.toThrow(AxiosError)
  })

  it('retrieves the operation log', async () => {
    const doc = await client.getDocumentData(did)
    const ops = await client.getOperationLog(did)
    const computedDoc = await document.validateOperationLog(did, ops)
    expect(computedDoc).toEqual(doc)
  })

  it('rejects on bad updates', async () => {
    const newKey = await EcdsaKeypair.create()
    const operation = client.rotateRecoveryKey(did, newKey.did(), newKey)
    await expect(operation).rejects.toThrow()
  })

  it('allows for recovery through a forked history', async () => {
    const attackerKey = await EcdsaKeypair.create()
    await client.rotateSigningKey(did, attackerKey.did(), signingKey)
    await client.rotateRecoveryKey(did, attackerKey.did(), attackerKey)

    const newKey = await EcdsaKeypair.create()
    const ops = await client.getOperationLog(did)
    const forkPoint = ops[ops.length - 3]
    const forkCid = await cidForData(forkPoint)
    await client.rotateSigningKey(did, newKey.did(), recoveryKey, forkCid)
    signingKey = newKey

    const doc = await client.getDocumentData(did)
    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.handle).toEqual(handle)
    expect(doc.atpPds).toEqual(atpPds)
  })

  it('retrieves the did doc', async () => {
    const data = await client.getDocumentData(did)
    const doc = await client.getDocument(did)
    expect(doc).toEqual(document.formatDidDoc(data))
  })

  it('handles concurrent requests to many docs', async () => {
    const COUNT = 100
    const keys: EcdsaKeypair[] = []
    for (let i = 0; i < COUNT; i++) {
      keys.push(await EcdsaKeypair.create())
    }
    await Promise.all(
      keys.map(async (key, index) => {
        await client.createDid(key, key.did(), `user${index}`, `example.com`)
      }),
    )
  })

  it('resolves races into a coherent history with no forks', async () => {
    const COUNT = 100
    const keys: EcdsaKeypair[] = []
    for (let i = 0; i < COUNT; i++) {
      keys.push(await EcdsaKeypair.create())
    }
    const prev = await client.getPrev(did)

    let successes = 0
    let failures = 0
    await Promise.all(
      keys.map(async (key) => {
        try {
          await client.rotateSigningKey(did, key.did(), signingKey, prev)
          successes++
        } catch (err) {
          failures++
        }
      }),
    )
    expect(successes).toBe(1)
    expect(failures).toBe(99)

    const ops = await client.getOperationLog(did)
    await document.validateOperationLog(did, ops)
  })

  it('healthcheck succeeds when database is available.', async () => {
    const { data, status } = await client.health()
    expect(status).toEqual(200)
    expect(data).toEqual({ version: '0.0.0' })
  })

  it('healthcheck fails when database is unavailable.', async () => {
    const { db } = locals.get(app)
    await db.db.destroy()
    let error: AxiosError
    try {
      await client.health()
      throw new Error('Healthcheck should have failed')
    } catch (err) {
      if (err instanceof AxiosError) {
        error = err
      } else {
        throw err
      }
    }
    expect(error.response?.status).toEqual(503)
    expect(error.response?.data).toEqual({
      version: '0.0.0',
      error: 'Service Unavailable',
    })
  })
})
