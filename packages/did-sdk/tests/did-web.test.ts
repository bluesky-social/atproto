import getPort from 'get-port'
import { resolve, DidWebServer, DIDDocument } from '../src/index'
import DidWebDb from '../src/web/db'

describe('did:web', () => {
  let server: DidWebServer | undefined

  beforeAll(async () => {
    const db = DidWebDb.memory()
    server = DidWebServer.create(db, await getPort())
    await new Promise((resolve, reject) => {
      server?._httpServer?.on('listening', resolve)
      server?._httpServer?.on('error', reject)
    })
  })

  afterAll(async () => {
    await server?.close()
    server = undefined
  })

  it('Resolve valid did:web', async () => {
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
      expect(didRes.didDoc).toEqual(didDoc)
      expect(didRes.getURI()).toBe(did)
      expect(didRes.getController()).toBe('did:example:123456')
      expect(didRes.listPublicKeys('assertionMethod')).toEqual([ed25519Key])
      expect(didRes.listPublicKeys('authentication')).toEqual([ed25519Key])
      expect(didRes.listPublicKeys('capabilityInvocation')).toEqual([
        ed25519Key,
      ])
      expect(didRes.listPublicKeys('capabilityDelegation')).toEqual([
        ed25519Key,
      ])
      expect(didRes.listPublicKeys('keyAgreement')).toEqual([])
      expect(didRes.getPublicKey('assertionMethod')).toEqual(ed25519Key)
      expect(didRes.getPublicKey('authentication')).toEqual(ed25519Key)
      expect(didRes.getPublicKey('capabilityInvocation')).toEqual(ed25519Key)
      expect(didRes.getPublicKey('capabilityDelegation')).toEqual(ed25519Key)
      expect(didRes.listServices()).toEqual([service])
      expect(didRes.getService(service.type)).toEqual(service)
    }
  })

  it('Resolve throws on malformed did:webs', async () => {
    await expect(resolve(`did:web:asdf`)).rejects.toThrow()
    await expect(resolve(`did:web:`)).rejects.toThrow()
    await expect(resolve(``)).rejects.toThrow()
  })
})
