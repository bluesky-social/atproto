import { createPublicKey, verify } from 'node:crypto'
import { beforeAll, describe, expect, it, test } from 'vitest'
import { P256Keypair, Secp256k1Keypair, parseDidKey } from '@atproto/crypto'
import { fromBase64, toBase64 } from '@atproto/lex-data'
import type { DidString } from '@atproto/syntax'
import { SpaceSignatureError } from './error.js'
import {
  createSpaceSig,
  createSpaceSigHeaders,
  verifyCredentialSig,
} from './http-signature.js'

const AUTHORIZATION = 'Atproto-Space-Credential credential'
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
    const input =
      '("authorization" "atproto-space-audience");tag="atproto-space-credential"'
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
      verifyCredentialSig(await signedHeaders(), keyId),
    ).resolves.toBeUndefined()
  })

  test.each([
    ['missing', ''],
    ['other', ';tag="other"'],
  ])('rejects a %s tag on a credential use', async (_name, tag) => {
    const headers = await signedHeaders()
    headers['signature-input'] = headers['signature-input'].replace(
      ';tag="atproto-space-credential"',
      tag,
    )
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /tag must be "atproto-space-credential"/,
    )
  })

  it('accepts high-S as well as low-S signatures', async () => {
    const headers = await signedHeaders()
    const sig = Buffer.from(
      headers.signature.slice('atproto-space-credential=:'.length, -1),
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
    headers.signature = `atproto-space-credential=:${sig.toString('base64')}:`
    await expect(verifyCredentialSig(headers, keyId)).resolves.toBeUndefined()
  })

  it('accepts optional credential parameters and other signature labels', async () => {
    const input = `("authorization" "atproto-space-audience");alg="ecdsa-p256-sha256";keyid="${keyId}";tag="atproto-space-credential"`
    const base = `"authorization": ${AUTHORIZATION}\n"atproto-space-audience": ${AUDIENCE}\n"@signature-params": ${input}`
    const sig = await key.sign(new TextEncoder().encode(base))
    await expect(
      verifyCredentialSig(
        {
          authorization: AUTHORIZATION,
          'atproto-space-audience': AUDIENCE,
          'signature-input': `other=("authorization");keyid="other", atproto-space-credential=${input}`,
          signature: `other=:YWJj:, atproto-space-credential=:${toBase64(sig)}:`,
        },
        keyId,
      ),
    ).resolves.toBeUndefined()
  })

  test.each(['authorization', 'atproto-space-audience'])(
    'rejects a changed %s',
    async (name) => {
      const headers = await signedHeaders()
      headers[name] += '-changed'
      await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
        SpaceSignatureError,
      )
    },
  )

  test.each(['authorization', 'atproto-space-audience'])(
    'rejects a multi-valued %s field',
    async (name) => {
      const headers = await signedHeaders()
      await expect(
        verifyCredentialSig(
          {
            ...headers,
            [name]: [headers[name], headers[name]],
          },
          keyId,
        ),
      ).rejects.toThrow(/malformed/)
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
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      SpaceSignatureError,
    )
  })

  it('requires the audience to be covered by the signature', async () => {
    const input = `("authorization");tag="atproto-space-credential"`
    const base = `"authorization": ${AUTHORIZATION}\n"@signature-params": ${input}`
    const sig = await key.sign(new TextEncoder().encode(base))
    await expect(
      verifyCredentialSig(
        {
          authorization: AUTHORIZATION,
          'atproto-space-audience': AUDIENCE,
          'signature-input': `atproto-space-credential=${input}`,
          signature: `atproto-space-credential=:${toBase64(sig)}:`,
        },
        keyId,
      ),
    ).rejects.toThrow(/must cover/)
  })

  it('rejects another signing key', async () => {
    const other = await P256Keypair.create()
    const headers = await createSpaceSigHeaders(other, {
      authorization: AUTHORIZATION,
      audience: AUDIENCE,
    })
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /invalid HTTP message signature/,
    )
  })

  it('rejects an optional keyid that differs from the credential key', async () => {
    const other = await P256Keypair.create()
    const headers = await signedHeaders()
    headers['signature-input'] += `;keyid="${other.did()}"`
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /keyid does not match the credential key/,
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
    headers['signature-input'] = `atproto-space-credential=${components}`
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /must cover exactly|missing or malformed/,
    )
  })

  it('rejects changed signature parameters', async () => {
    const headers = await signedHeaders()
    headers['signature-input'] += ';alg="ecdsa-p256-sha256"'
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /invalid HTTP message signature/,
    )
  })

  it('rejects other algorithms', async () => {
    const headers = await signedHeaders()
    headers['signature-input'] += ';alg="ecdsa-p384-sha384"'
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /algorithm/,
    )
  })

  it('rejects other key types', async () => {
    const other = await Secp256k1Keypair.create()
    await expect(
      createSpaceSigHeaders(other, {
        authorization: AUTHORIZATION,
        audience: AUDIENCE,
      }),
    ).rejects.toThrow(/P-256/)
    const headers = await signedHeaders()
    await expect(
      verifyCredentialSig(headers, other.did() as DidString),
    ).rejects.toThrow(/P-256/)
  })

  test.each(['not-a-byte-sequence', ':YWJj:', ':!!!:'])(
    'rejects an invalid signature: %s',
    async (signature) => {
      const headers = await signedHeaders()
      headers.signature = `atproto-space-credential=${signature}`
      await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
        SpaceSignatureError,
      )
    },
  )

  it('rejects a DER-encoded signature', async () => {
    const headers = await signedHeaders()
    const compact = fromBase64(
      headers.signature.slice('atproto-space-credential=:'.length, -1),
    )
    const integers = [compact.slice(0, 32), compact.slice(32)]
      .map((value) => {
        const bytes = value[0] & 0x80 ? [0, ...value] : [...value]
        return [2, bytes.length, ...bytes]
      })
      .flat()
    headers.signature = `atproto-space-credential=:${toBase64(new Uint8Array([0x30, integers.length, ...integers]))}:`
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      SpaceSignatureError,
    )
  })
})
