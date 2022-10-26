import { EcdsaKeypair, Secp256k1Keypair } from '../src'
import * as did from '../src/did'
import * as uint8arrays from 'uint8arrays'

describe('secp256k1 did:key', () => {
  it('derives the correct DID from the privatekey', async () => {
    for (const vector of secpTestVectors) {
      const keypair = await Secp256k1Keypair.import(vector.seed)
      const did = keypair.did()
      expect(did).toEqual(vector.id)
    }
  })

  it('converts between bytes and did', async () => {
    for (const vector of secpTestVectors) {
      const keypair = await Secp256k1Keypair.import(vector.seed)
      const didKey = did.formatDidKey('ES256K', keypair.publicKeyBytes())
      expect(didKey).toEqual(vector.id)
      const { jwtAlg, keyBytes } = did.parseDidKey(didKey)
      expect(jwtAlg).toBe('ES256K')
      expect(uint8arrays.equals(keyBytes, keypair.publicKeyBytes())).toBeTruthy
    }
  })
})

describe('ecdsa did:key', () => {
  it('derives the correct DID from the JWK', async () => {
    for (const vector of p256TestVectors) {
      const keypair = await EcdsaKeypair.import(vector.jwk)
      const did = keypair.did()
      expect(did).toEqual(vector.id)
    }
  })

  it('converts between bytes and did', async () => {
    for (const vector of p256TestVectors) {
      const keypair = await EcdsaKeypair.import(vector.jwk)
      const didKey = did.formatDidKey('ES256', keypair.publicKeyBytes())
      expect(didKey).toEqual(vector.id)
      const { jwtAlg, keyBytes } = did.parseDidKey(didKey)
      expect(jwtAlg).toBe('ES256')
      expect(uint8arrays.equals(keyBytes, keypair.publicKeyBytes())).toBeTruthy
    }
  })
})

// did:key secp256k1 test vectors from W3C
// https://github.com/w3c-ccg/did-method-key/blob/main/test-vectors/secp256k1.json
const secpTestVectors = [
  {
    seed: '9085d2bef69286a6cbb51623c8fa258629945cd55ca705cc4e66700396894e0c',
    id: 'did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme',
  },
  {
    seed: 'f0f4df55a2b3ff13051ea814a8f24ad00f2e469af73c363ac7e9fb999a9072ed',
    id: 'did:key:zQ3shtxV1FrJfhqE1dvxYRcCknWNjHc3c5X1y3ZSoPDi2aur2',
  },
  {
    seed: '6b0b91287ae3348f8c2f2552d766f30e3604867e34adc37ccbb74a8e6b893e02',
    id: 'did:key:zQ3shZc2QzApp2oymGvQbzP8eKheVshBHbU4ZYjeXqwSKEn6N',
  },
  {
    seed: 'c0a6a7c560d37d7ba81ecee9543721ff48fea3e0fb827d42c1868226540fac15',
    id: 'did:key:zQ3shadCps5JLAHcZiuX5YUtWHHL8ysBJqFLWvjZDKAWUBGzy',
  },
  {
    seed: '175a232d440be1e0788f25488a73d9416c04b6f924bea6354bf05dd2f1a75133',
    id: 'did:key:zQ3shptjE6JwdkeKN4fcpnYQY3m9Cet3NiHdAfpvSUZBFoKBj',
  },
]

// did:key p-256 test vectors from W3C
// https://github.com/w3c-ccg/did-method-key/blob/main/test-vectors/nist-curves.json
const p256TestVectors = [
  {
    id: 'did:key:zDnaerx9CtbPJ1q36T5Ln5wYt3MQYeGRG5ehnPAmxcf5mDZpv',
    jwk: {
      kty: 'EC',
      crv: 'P-256',
      x: 'igrFmi0whuihKnj9R3Om1SoMph72wUGeFaBbzG2vzns',
      y: 'efsX5b10x8yjyrj4ny3pGfLcY7Xby1KzgqOdqnsrJIM',
      d: 'gPh-VvVS8MbvKQ9LSVVmfnxnKjHn4Tqj0bmbpehRlpc',
    },
  },
  {
    id: 'did:key:zDnaerDaTF5BXEavCrfRZEk316dpbLsfPDZ3WJ5hRTPFU2169',
    jwk: {
      kty: 'EC',
      crv: 'P-256',
      x: 'fyNYMN0976ci7xqiSdag3buk-ZCwgXU4kz9XNkBlNUI',
      y: 'hW2ojTNfH7Jbi8--CJUo3OCbH3y5n91g-IMA9MLMbTU',
      d: 'YjRs6vNvw4sYrzVVY8ipkEpDAD9PFqw1sUnvPRMA-WI',
    },
  },
]
