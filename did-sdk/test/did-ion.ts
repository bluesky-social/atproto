import test from 'ava'
import getPort from 'get-port'
import { resolve, ion } from '../src/index.js'
import { createDidIonServer, MockDidIonServer } from './util/mock-ion-server.js'

const TEST_ION_DID = `did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw:eyJkZWx0YSI6eyJwYXRjaGVzIjpbeyJhY3Rpb24iOiJyZXBsYWNlIiwiZG9jdW1lbnQiOnsicHVibGljS2V5cyI6W3siaWQiOiJzaWdfNzJiZDE2ZDYiLCJwdWJsaWNLZXlKd2siOnsiY3J2Ijoic2VjcDI1NmsxIiwia3R5IjoiRUMiLCJ4IjoiS2JfMnVOR3Nyd1VOdkh2YUNOckRGdW14VXlQTWZZd3kxNEpZZmphQUhmayIsInkiOiJhSFNDZDVEOFh0RUxvSXBpN1A5eDV1cXBpeEVxNmJDenQ0QldvUVk1UUFRIn0sInB1cnBvc2VzIjpbImF1dGhlbnRpY2F0aW9uIiwiYXNzZXJ0aW9uTWV0aG9kIl0sInR5cGUiOiJFY2RzYVNlY3AyNTZrMVZlcmlmaWNhdGlvbktleTIwMTkifV0sInNlcnZpY2VzIjpbeyJpZCI6ImxpbmtlZGRvbWFpbnMiLCJzZXJ2aWNlRW5kcG9pbnQiOnsib3JpZ2lucyI6WyJodHRwczovL3d3dy52Y3NhdG9zaGkuY29tLyJdfSwidHlwZSI6IkxpbmtlZERvbWFpbnMifV19fV0sInVwZGF0ZUNvbW1pdG1lbnQiOiJFaUR4SWxJak9xQk5NTGZjdzZndWpHNEdFVDM3UjBIRWM2Z20xclNZTjlMOF9RIn0sInN1ZmZpeERhdGEiOnsiZGVsdGFIYXNoIjoiRWlBLXV3TWo3RVFheURmWTRJS3pfSE9LdmJZQ05td19Tb1lhUmhOcWhFSWhudyIsInJlY292ZXJ5Q29tbWl0bWVudCI6IkVpQ0czQ1M5RFJpeU1JRVoxRl9sSjZnRVRMZWVHREwzZnpuQUViMVRGdFZXNEEifX0#sig_72bd16d6`
const TEST_ION_DID_DOC = {
  '@context': 'https://w3id.org/did-resolution/v1',
  didDocument: {
    id: 'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw:eyJkZWx0YSI6eyJwYXRjaGVzIjpbeyJhY3Rpb24iOiJyZXBsYWNlIiwiZG9jdW1lbnQiOnsicHVibGljS2V5cyI6W3siaWQiOiJzaWdfNzJiZDE2ZDYiLCJwdWJsaWNLZXlKd2siOnsiY3J2Ijoic2VjcDI1NmsxIiwia3R5IjoiRUMiLCJ4IjoiS2JfMnVOR3Nyd1VOdkh2YUNOckRGdW14VXlQTWZZd3kxNEpZZmphQUhmayIsInkiOiJhSFNDZDVEOFh0RUxvSXBpN1A5eDV1cXBpeEVxNmJDenQ0QldvUVk1UUFRIn0sInB1cnBvc2VzIjpbImF1dGhlbnRpY2F0aW9uIiwiYXNzZXJ0aW9uTWV0aG9kIl0sInR5cGUiOiJFY2RzYVNlY3AyNTZrMVZlcmlmaWNhdGlvbktleTIwMTkifV0sInNlcnZpY2VzIjpbeyJpZCI6ImxpbmtlZGRvbWFpbnMiLCJzZXJ2aWNlRW5kcG9pbnQiOnsib3JpZ2lucyI6WyJodHRwczovL3d3dy52Y3NhdG9zaGkuY29tLyJdfSwidHlwZSI6IkxpbmtlZERvbWFpbnMifV19fV0sInVwZGF0ZUNvbW1pdG1lbnQiOiJFaUR4SWxJak9xQk5NTGZjdzZndWpHNEdFVDM3UjBIRWM2Z20xclNZTjlMOF9RIn0sInN1ZmZpeERhdGEiOnsiZGVsdGFIYXNoIjoiRWlBLXV3TWo3RVFheURmWTRJS3pfSE9LdmJZQ05td19Tb1lhUmhOcWhFSWhudyIsInJlY292ZXJ5Q29tbWl0bWVudCI6IkVpQ0czQ1M5RFJpeU1JRVoxRl9sSjZnRVRMZWVHREwzZnpuQUViMVRGdFZXNEEifX0',
    '@context': [
      'https://www.w3.org/ns/did/v1',
      {
        '@base':
          'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw:eyJkZWx0YSI6eyJwYXRjaGVzIjpbeyJhY3Rpb24iOiJyZXBsYWNlIiwiZG9jdW1lbnQiOnsicHVibGljS2V5cyI6W3siaWQiOiJzaWdfNzJiZDE2ZDYiLCJwdWJsaWNLZXlKd2siOnsiY3J2Ijoic2VjcDI1NmsxIiwia3R5IjoiRUMiLCJ4IjoiS2JfMnVOR3Nyd1VOdkh2YUNOckRGdW14VXlQTWZZd3kxNEpZZmphQUhmayIsInkiOiJhSFNDZDVEOFh0RUxvSXBpN1A5eDV1cXBpeEVxNmJDenQ0QldvUVk1UUFRIn0sInB1cnBvc2VzIjpbImF1dGhlbnRpY2F0aW9uIiwiYXNzZXJ0aW9uTWV0aG9kIl0sInR5cGUiOiJFY2RzYVNlY3AyNTZrMVZlcmlmaWNhdGlvbktleTIwMTkifV0sInNlcnZpY2VzIjpbeyJpZCI6ImxpbmtlZGRvbWFpbnMiLCJzZXJ2aWNlRW5kcG9pbnQiOnsib3JpZ2lucyI6WyJodHRwczovL3d3dy52Y3NhdG9zaGkuY29tLyJdfSwidHlwZSI6IkxpbmtlZERvbWFpbnMifV19fV0sInVwZGF0ZUNvbW1pdG1lbnQiOiJFaUR4SWxJak9xQk5NTGZjdzZndWpHNEdFVDM3UjBIRWM2Z20xclNZTjlMOF9RIn0sInN1ZmZpeERhdGEiOnsiZGVsdGFIYXNoIjoiRWlBLXV3TWo3RVFheURmWTRJS3pfSE9LdmJZQ05td19Tb1lhUmhOcWhFSWhudyIsInJlY292ZXJ5Q29tbWl0bWVudCI6IkVpQ0czQ1M5RFJpeU1JRVoxRl9sSjZnRVRMZWVHREwzZnpuQUViMVRGdFZXNEEifX0',
      },
    ],
    service: [
      {
        id: '#linkeddomains',
        type: 'LinkedDomains',
        serviceEndpoint: {
          origins: ['https://www.vcsatoshi.com/'],
        },
      },
    ],
    verificationMethod: [
      {
        id: '#sig_72bd16d6',
        controller:
          'did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw:eyJkZWx0YSI6eyJwYXRjaGVzIjpbeyJhY3Rpb24iOiJyZXBsYWNlIiwiZG9jdW1lbnQiOnsicHVibGljS2V5cyI6W3siaWQiOiJzaWdfNzJiZDE2ZDYiLCJwdWJsaWNLZXlKd2siOnsiY3J2Ijoic2VjcDI1NmsxIiwia3R5IjoiRUMiLCJ4IjoiS2JfMnVOR3Nyd1VOdkh2YUNOckRGdW14VXlQTWZZd3kxNEpZZmphQUhmayIsInkiOiJhSFNDZDVEOFh0RUxvSXBpN1A5eDV1cXBpeEVxNmJDenQ0QldvUVk1UUFRIn0sInB1cnBvc2VzIjpbImF1dGhlbnRpY2F0aW9uIiwiYXNzZXJ0aW9uTWV0aG9kIl0sInR5cGUiOiJFY2RzYVNlY3AyNTZrMVZlcmlmaWNhdGlvbktleTIwMTkifV0sInNlcnZpY2VzIjpbeyJpZCI6ImxpbmtlZGRvbWFpbnMiLCJzZXJ2aWNlRW5kcG9pbnQiOnsib3JpZ2lucyI6WyJodHRwczovL3d3dy52Y3NhdG9zaGkuY29tLyJdfSwidHlwZSI6IkxpbmtlZERvbWFpbnMifV19fV0sInVwZGF0ZUNvbW1pdG1lbnQiOiJFaUR4SWxJak9xQk5NTGZjdzZndWpHNEdFVDM3UjBIRWM2Z20xclNZTjlMOF9RIn0sInN1ZmZpeERhdGEiOnsiZGVsdGFIYXNoIjoiRWlBLXV3TWo3RVFheURmWTRJS3pfSE9LdmJZQ05td19Tb1lhUmhOcWhFSWhudyIsInJlY292ZXJ5Q29tbWl0bWVudCI6IkVpQ0czQ1M5RFJpeU1JRVoxRl9sSjZnRVRMZWVHREwzZnpuQUViMVRGdFZXNEEifX0',
        type: 'EcdsaSecp256k1VerificationKey2019',
        publicKeyJwk: {
          crv: 'secp256k1',
          kty: 'EC',
          x: 'Kb_2uNGsrwUNvHvaCNrDFumxUyPMfYwy14JYfjaAHfk',
          y: 'aHSCd5D8XtELoIpi7P9x5uqpixEq6bCzt4BWoQY5QAQ',
        },
      },
    ],
    authentication: ['#sig_72bd16d6'],
    assertionMethod: ['#sig_72bd16d6'],
  },
  didDocumentMetadata: {
    method: {
      published: false,
      recoveryCommitment: 'EiCG3CS9DRiyMIEZ1F_lJ6gETLeeGDL3fznAEb1TFtVW4A',
      updateCommitment: 'EiDxIlIjOqBNMLfcw6gujG4GET37R0HEc6gm1rSYN9L8_Q',
    },
    equivalentId: ['did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw'],
  },
}

let server: MockDidIonServer | undefined

test.before('Server setup', async (t) => {
  console.log('starting')
  server = await createDidIonServer(await getPort())
})

test.after('Server teardown', async (t) => {
  await server?.close()
  server = undefined
})

test('Resolve valid did:ion', async (t) => {
  const didRes = await resolve(TEST_ION_DID)
  t.deepEqual(didRes.didDoc, TEST_ION_DID_DOC.didDocument)
  t.deepEqual(didRes.didDocMetadata, TEST_ION_DID_DOC.didDocumentMetadata)
})

test('Create, update, recover, and deactivate did:ion (dummy server)', async (t) => {
  const service = {
    id: 'service1',
    type: 'SomeService',
    serviceEndpoint: 'https://example.com',
  }
  const service2 = {
    id: 'service2',
    type: 'SomeService',
    serviceEndpoint: 'https://foobar.com',
  }

  // create
  const did = await ion.create(
    { services: [service] },
    {
      ionResolveEndpoint: server?.resolveEndpoint,
      ionChallengeEndpoint: server?.challengeEndpoint,
      ionSolutionEndpoint: server?.solutionEndpoint,
    },
  )
  const did2 = await ion.resolve(did.getURI(), server?.resolveEndpoint)
  t.deepEqual(did.didDoc, did2.didDoc)
  t.is(did.getService(service.type)?.serviceEndpoint, service.serviceEndpoint)

  // update
  await did.update({
    addServices: [service2],
  })
  const did3 = await ion.resolve(did.getURI(), server?.resolveEndpoint)
  t.deepEqual(did.didDoc, did3.didDoc)
  t.deepEqual(
    did
      .listServices()
      .map((s) => s.serviceEndpoint)
      .sort(),
    [service.serviceEndpoint, service2.serviceEndpoint].sort(),
  )

  // update2
  await did.update({
    removeServices: [service.id],
  })
  const did4 = await ion.resolve(did.getURI(), server?.resolveEndpoint)
  t.deepEqual(did.didDoc, did4.didDoc)
  t.deepEqual(
    did
      .listServices()
      .map((s) => s.serviceEndpoint)
      .sort(),
    [service2.serviceEndpoint].sort(),
  )

  // recover
  await did.recover({
    services: [service],
  })
  const did5 = await ion.resolve(did.getURI(), server?.resolveEndpoint)
  t.deepEqual(did.didDoc, did5.didDoc)
  t.is(did.getService(service.type)?.serviceEndpoint, service.serviceEndpoint)

  // deactivate
  await did.deactivate()
  const did6 = await ion.resolve(did.getURI(), server?.resolveEndpoint)
  t.deepEqual(did.didDoc, did6.didDoc)
  await t.throwsAsync(() => {
    return did.update({
      addServices: [service2],
    })
  })
})

test('Serialize and hydrate did:ion', async (t) => {
  const service = {
    id: 'service1',
    type: 'SomeService',
    serviceEndpoint: 'https://example.com',
  }
  const didDoc = await ion.create(
    { services: [service] },
    {
      ionResolveEndpoint: server?.resolveEndpoint,
      ionChallengeEndpoint: server?.challengeEndpoint,
      ionSolutionEndpoint: server?.solutionEndpoint,
    },
  )
  const state = JSON.stringify(didDoc.serialize(), null, 2)
  const didDoc2 = await ion.inst(JSON.parse(state))
  t.deepEqual(didDoc.didDoc, didDoc2.didDoc)
})

test('Resolve throws on malformed did:ions', async (t) => {
  await t.throwsAsync(() => resolve(`did:ion:asdf`))
  await t.throwsAsync(() => resolve(`did:ion:`))
  await t.throwsAsync(() => resolve(``))
})
