import test from 'ava'
import getPort from 'get-port'
import { resolve, DidWebServer, DIDDocument } from '../src/index.js'
import DidWebDb from '../src/web/db.js'

let server: DidWebServer | undefined

test.before('Server setup', async (t) => {
  const db = DidWebDb.memory()
  server = await DidWebServer.create(db, await getPort())
})

test.after('Server teardown', async (t) => {
  await server?.close()
  server = undefined
})

test('Resolve valid did:web', async (t) => {
  const domain = encodeURIComponent(`localhost:${server?.port}`)
  for (const did of [
    `did:web:${domain}`,
    `did:web:${domain}:alice`,
    `did:web:${domain}:user:alice`,
  ]) {
    const ed25519Key = {
      id: `#key1`,
      type: 'Ed25519VerificationKey2018',
      controller: did,
      publicKeyBase58: 'B12NYF8RrR3h41TDCTJojY59usg3mbtbjnFs7Eud1Y6u',
    }
    const service = {
      id: '#service1',
      type: 'SomeService',
      serviceEndpoint: 'https://example.com',
    }
    const didDoc: DIDDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2018/v1',
        'https://w3id.org/security/suites/x25519-2019/v1',
      ],
      id: did,
      controller: 'did:example:123456',
      verificationMethod: [ed25519Key],
      assertionMethod: ['#key1'],
      authentication: ['#key1'],
      capabilityInvocation: ['#key1'],
      capabilityDelegation: ['#key1'],
      service: [service],
    }
    await server?.put(didDoc)
    const didRes = await resolve(did)
    t.deepEqual(didRes.didDoc, didDoc)
    t.is(didRes.getURI(), did)
    t.is(didRes.getController(), 'did:example:123456')
    t.deepEqual(didRes.listPublicKeys('assertionMethod'), [ed25519Key])
    t.deepEqual(didRes.listPublicKeys('authentication'), [ed25519Key])
    t.deepEqual(didRes.listPublicKeys('capabilityInvocation'), [ed25519Key])
    t.deepEqual(didRes.listPublicKeys('capabilityDelegation'), [ed25519Key])
    t.deepEqual(didRes.listPublicKeys('keyAgreement'), [])
    t.deepEqual(didRes.getPublicKey('assertionMethod'), ed25519Key)
    t.deepEqual(didRes.getPublicKey('authentication'), ed25519Key)
    t.deepEqual(didRes.getPublicKey('capabilityInvocation'), ed25519Key)
    t.deepEqual(didRes.getPublicKey('capabilityDelegation'), ed25519Key)
    t.deepEqual(didRes.listServices(), [service])
    t.deepEqual(didRes.getService(service.type), service)
  }
})

test('Resolve throws on malformed did:webs', async (t) => {
  await t.throwsAsync(() => resolve(`did:web:asdf`))
  await t.throwsAsync(() => resolve(`did:web:`))
  await t.throwsAsync(() => resolve(``))
})
