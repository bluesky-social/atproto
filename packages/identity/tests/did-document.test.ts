import { DidResolver, ensureAtpDocument } from '../src'

describe('did parsing', () => {
  it('throws on bad DID document', async () => {
    const did = 'did:plc:yk4dd2qkboz2yv6tpubpc6co'
    const docJson = `{
  "ideep": "did:plc:yk4dd2qkboz2yv6tpubpc6co",
  "blah": [
    "https://dholms.xyz"
  ],
  "zoot": [
    {
      "id": "#elsewhere",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:plc:yk4dd2qkboz2yv6tpubpc6co",
      "publicKeyMultibase": "zQYEBzXeuTM9UR3rfvNag6L3RNAs5pQZyYPsomTsgQhsxLdEgCrPTLgFna8yqCnxPpNT7DBk6Ym3dgPKNu86vt9GR"
    }
  ],
  "yarg": [ ]
}`
    const resolver = new DidResolver({})
    expect(() => {
      resolver.validateDidDoc(did, JSON.parse(docJson))
    }).toThrow()
  })

  it('parses legacy DID format, extracts atpData', async () => {
    const did = 'did:plc:yk4dd2qkboz2yv6tpubpc6co'
    const docJson = `{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/secp256k1-2019/v1"
  ],
  "id": "did:plc:yk4dd2qkboz2yv6tpubpc6co",
  "alsoKnownAs": [
    "at://dholms.xyz"
  ],
  "verificationMethod": [
    {
      "id": "#atproto",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:plc:yk4dd2qkboz2yv6tpubpc6co",
      "publicKeyMultibase": "zQYEBzXeuTM9UR3rfvNag6L3RNAs5pQZyYPsomTsgQhsxLdEgCrPTLgFna8yqCnxPpNT7DBk6Ym3dgPKNu86vt9GR"
    }
  ],
  "service": [
    {
      "id": "#atproto_pds",
      "type": "AtprotoPersonalDataServer",
      "serviceEndpoint": "https://bsky.social"
    }
  ]
}`
    const resolver = new DidResolver({})
    const doc = resolver.validateDidDoc(did, JSON.parse(docJson))
    const atpData = ensureAtpDocument(doc)
    expect(atpData.did).toEqual(did)
    expect(atpData.handle).toEqual('dholms.xyz')
    expect(atpData.pds).toEqual('https://bsky.social')
    expect(atpData.signingKey).toEqual(
      'did:key:zQ3shXjHeiBuRCKmM36cuYnm7YEMzhGnCmCyW92sRJ9pribSF',
    )
  })

  it('parses newer Multikey DID format, extracts atpData', async () => {
    const did = 'did:plc:yk4dd2qkboz2yv6tpubpc6co'
    const docJson = `{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/multikey/v1",
    "https://w3id.org/security/suites/secp256k1-2019/v1"
  ],
  "id": "did:plc:yk4dd2qkboz2yv6tpubpc6co",
  "alsoKnownAs": [
    "at://dholms.xyz"
  ],
  "verificationMethod": [
    {
      "id": "did:plc:yk4dd2qkboz2yv6tpubpc6co#atproto",
      "type": "Multikey",
      "controller": "did:plc:yk4dd2qkboz2yv6tpubpc6co",
      "publicKeyMultibase": "zQ3shXjHeiBuRCKmM36cuYnm7YEMzhGnCmCyW92sRJ9pribSF"
    }
  ],
  "service": [
    {
      "id": "#atproto_pds",
      "type": "AtprotoPersonalDataServer",
      "serviceEndpoint": "https://bsky.social"
    }
  ]
}`
    const resolver = new DidResolver({})
    const doc = resolver.validateDidDoc(did, JSON.parse(docJson))
    const atpData = ensureAtpDocument(doc)
    expect(atpData.did).toEqual(did)
    expect(atpData.handle).toEqual('dholms.xyz')
    expect(atpData.pds).toEqual('https://bsky.social')
    expect(atpData.signingKey).toEqual(
      'did:key:zQ3shXjHeiBuRCKmM36cuYnm7YEMzhGnCmCyW92sRJ9pribSF',
    )
  })
})
