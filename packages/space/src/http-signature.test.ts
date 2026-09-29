import { createPublicKey, verify } from 'node:crypto'
import { beforeAll, describe, expect, it, test } from 'vitest'
import { P256Keypair, Secp256k1Keypair, parseDidKey } from '@atproto/crypto'
import { fromBase64, toBase64 } from '@atproto/lex-data'
import type { DidString } from '@atproto/syntax'
import { SpaceSignatureError } from './error.js'
import {
  createSpaceSig,
  createSpaceSigHeaders,
  verifySpaceSignature,
} from './http-signature.js'

const AUTHORIZATION = 'Atproto-Space credential'
const AUDIENCE: DidString = 'did:example:repo'

describe('space HTTP message signatures', () => {
  let key: P256Keypair
  let keyId: DidString

  beforeAll(async () => {
    key = await P256Keypair.create()
    keyId = key.did() as DidString
  })

  const signedHeaders = () =>
    createSpaceSigHeaders(key, {
      authorization: AUTHORIZATION,
      audience: AUDIENCE,
    })

  it('signs the RFC 9421 signature base with a compact P-256 signature', async () => {
    const { signatureInput, signature } = await createSpaceSig(key, {
      authorization: AUTHORIZATION,
      audience: AUDIENCE,
    })
    const input = `("authorization" "atproto-space-audience");keyid="${keyId}";alg="ecdsa-p256-sha256"`
    expect(signatureInput).toBe(input)
    const base = `"authorization": ${AUTHORIZATION}\n"atproto-space-audience": ${AUDIENCE}\n"@signature-params": ${input}`
    const bytes = parseDidKey(keyId).keyBytes
    const publicKey = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: toBase64(bytes.subarray(1, 33), 'base64url'),
        y: toBase64(bytes.subarray(33), 'base64url'),
      },
      format: 'jwk',
    })
    expect(signature.length).toBe(64)
    expect(
      verify(
        'sha256',
        Buffer.from(base),
        {
          key: publicKey,
          dsaEncoding: 'ieee-p1363',
        },
        signature,
      ),
    ).toBe(true)
    await expect(
      verifySpaceSignature(await signedHeaders(), keyId),
    ).resolves.toBe(keyId)
  })

  it('signs a delegation token without an audience', async () => {
    const headers = await createSpaceSigHeaders(key, {
      authorization: 'Bearer delegation',
    })
    expect(headers['atproto-space-audience']).toBeUndefined()
    await expect(verifySpaceSignature(headers)).resolves.toBe(keyId)
    await expect(verifySpaceSignature(headers, keyId)).rejects.toThrow(
      /atproto-space-audience/,
    )
  })

  it('accepts high-S as well as low-S signatures', async () => {
    const headers = await signedHeaders()
    const sig = Buffer.from(
      headers.signature.slice('atproto-space=:'.length, -1),
      'base64',
    )
    const order =
      0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n
    const lowS = BigInt(`0x${sig.subarray(32).toString('hex')}`)
    expect(lowS < order / 2n).toBe(true)
    const highS = Buffer.from(
      (order - lowS).toString(16).padStart(64, '0'),
      'hex',
    )
    highS.copy(sig, 32)
    headers.signature = `atproto-space=:${sig.toString('base64')}:`
    await expect(verifySpaceSignature(headers, keyId)).resolves.toBe(keyId)
  })

  it('accepts either parameter order and other signature labels', async () => {
    const input = `("authorization" "atproto-space-audience");alg="ecdsa-p256-sha256";keyid="${keyId}"`
    const base = `"authorization": ${AUTHORIZATION}\n"atproto-space-audience": ${AUDIENCE}\n"@signature-params": ${input}`
    const sig = await key.sign(new TextEncoder().encode(base))
    await expect(
      verifySpaceSignature(
        {
          authorization: AUTHORIZATION,
          'atproto-space-audience': AUDIENCE,
          'signature-input': `other=("authorization");keyid="other", atproto-space=${input}`,
          signature: `other=:YWJj:, atproto-space=:${toBase64(sig)}:`,
        },
        keyId,
      ),
    ).resolves.toBe(keyId)
  })

  test.each(['authorization', 'atproto-space-audience'])(
    'rejects a changed %s',
    async (name) => {
      const headers = await signedHeaders()
      headers[name] += '-changed'
      await expect(verifySpaceSignature(headers, keyId)).rejects.toThrow(
        SpaceSignatureError,
      )
    },
  )

  test.each(['authorization', 'atproto-space-audience'])(
    'rejects duplicate %s fields',
    async (name) => {
      const headers = await signedHeaders()
      await expect(
        verifySpaceSignature(
          {
            ...headers,
            [name]: [headers[name], headers[name]],
          },
          keyId,
        ),
      ).rejects.toThrow(/exactly one/)
    },
  )

  test.each([
    'authorization',
    'atproto-space-audience',
    'signature-input',
    'signature',
  ])('rejects a missing %s', async (name) => {
    const headers = await signedHeaders()
    delete headers[name]
    await expect(verifySpaceSignature(headers, keyId)).rejects.toThrow(
      SpaceSignatureError,
    )
  })

  it('requires the audience to be covered by the signature', async () => {
    const headers = await createSpaceSigHeaders(key, {
      authorization: AUTHORIZATION,
    })
    headers['atproto-space-audience'] = AUDIENCE
    await expect(verifySpaceSignature(headers, keyId)).rejects.toThrow(
      /must cover/,
    )
  })

  it('rejects another signing key', async () => {
    const other = await P256Keypair.create()
    const headers = await createSpaceSigHeaders(other, {
      authorization: AUTHORIZATION,
      audience: AUDIENCE,
    })
    await expect(verifySpaceSignature(headers, keyId)).rejects.toThrow(
      /key the credential is bound to/,
    )
  })

  test.each([
    ['missing authorization', '("atproto-space-audience")'],
    ['reversed headers', '("atproto-space-audience" "authorization")'],
    [
      'additional header',
      '("authorization" "atproto-space-audience" "content-type")',
    ],
    [
      'duplicate component',
      '("authorization" "authorization" "atproto-space-audience")',
    ],
    [
      'unsupported component parameter',
      '("authorization";sf "atproto-space-audience")',
    ],
    ['malformed input', 'not-a-list'],
  ])('rejects %s', async (_name, components) => {
    const headers = await signedHeaders()
    headers['signature-input'] =
      `atproto-space=${components};keyid="${keyId}";alg="ecdsa-p256-sha256"`
    await expect(verifySpaceSignature(headers, keyId)).rejects.toThrow(
      /must cover exactly|missing or malformed/,
    )
  })

  it('rejects credential signatures on the delegation exchange', async () => {
    await expect(verifySpaceSignature(await signedHeaders())).rejects.toThrow(
      /must cover exactly/,
    )
  })

  it('rejects additional signature parameters', async () => {
    const headers = await signedHeaders()
    headers['signature-input'] += ';created=1738368000'
    await expect(verifySpaceSignature(headers, keyId)).rejects.toThrow(
      /only keyid and alg/,
    )
  })

  it('rejects other algorithms and key types', async () => {
    const headers = await signedHeaders()
    headers['signature-input'] = headers['signature-input'].replace(
      'ecdsa-p256-sha256',
      'ecdsa-p384-sha384',
    )
    await expect(verifySpaceSignature(headers, keyId)).rejects.toThrow(
      /algorithm/,
    )
    const other = await Secp256k1Keypair.create()
    await expect(
      createSpaceSigHeaders(other, { authorization: AUTHORIZATION }),
    ).rejects.toThrow(/P-256/)
    headers['signature-input'] =
      `atproto-space=("authorization");keyid="${other.did()}";alg="ecdsa-p256-sha256"`
    await expect(verifySpaceSignature(headers)).rejects.toThrow(/P-256/)
  })

  test.each(['not-a-byte-sequence', ':YWJj:', ':!!!:'])(
    'rejects an invalid signature: %s',
    async (signature) => {
      const headers = await signedHeaders()
      headers.signature = `atproto-space=${signature}`
      await expect(verifySpaceSignature(headers, keyId)).rejects.toThrow(
        SpaceSignatureError,
      )
    },
  )

  it('rejects a DER-encoded signature', async () => {
    const headers = await signedHeaders()
    const compact = fromBase64(
      headers.signature.slice('atproto-space=:'.length, -1),
    )
    const integers = [compact.slice(0, 32), compact.slice(32)]
      .map((value) => {
        const bytes = value[0] & 0x80 ? [0, ...value] : [...value]
        return [2, bytes.length, ...bytes]
      })
      .flat()
    headers.signature = `atproto-space=:${toBase64(new Uint8Array([0x30, integers.length, ...integers]))}:`
    await expect(verifySpaceSignature(headers, keyId)).rejects.toThrow(
      SpaceSignatureError,
    )
  })
})
