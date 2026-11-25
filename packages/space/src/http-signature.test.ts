import { createPublicKey, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  type Keypair,
  P256Keypair,
  Secp256k1Keypair,
  parseDidKey,
} from '@atproto/crypto'
import { fromBase64, toBase64 } from '@atproto/lex-data'
import type { DidString } from '@atproto/syntax'
import { createSpaceSigHeaders, verifyCredentialSig } from './http-signature.js'

const AUTHORIZATION = 'Atproto-Space-Credential credential'
const AUDIENCE: DidString = 'did:example:repo'
const SIGNATURE_INPUT =
  '("authorization" "atproto-space-audience");tag="atproto-space-credential"'

const key = await P256Keypair.create()
const keyId = key.did() as DidString

const signedHeaders = async (keypair: Keypair = key) => {
  const { headers } = await createSpaceSigHeaders({
    authorization: AUTHORIZATION,
    audience: AUDIENCE,
    keypair,
  })
  return headers as Record<string, string | string[]>
}

// The RFC 9421 signature base of a credential use under `signatureParams`.
const signatureBase = (signatureParams: string) =>
  `"authorization": ${AUTHORIZATION}\n"atproto-space-audience": ${AUDIENCE}\n"@signature-params": ${signatureParams}`

const signatureBytes = (header: string) =>
  fromBase64(header.slice('sig=:'.length, -1))

describe(createSpaceSigHeaders, () => {
  it('signs the RFC 9421 base with a compact P-256 signature', async () => {
    const headers = await signedHeaders()
    expect(headers).toEqual({
      authorization: AUTHORIZATION,
      'atproto-space-audience': AUDIENCE,
      'signature-input': `sig=${SIGNATURE_INPUT}`,
      signature: expect.stringMatching(/^sig=:[A-Za-z0-9+/]+=*:$/),
    })

    const signature = signatureBytes(headers.signature as string)
    const keyBytes = parseDidKey(keyId).keyBytes
    const publicKey = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: toBase64(keyBytes.subarray(1, 33), 'base64url'),
        y: toBase64(keyBytes.subarray(33), 'base64url'),
      },
      format: 'jwk',
    })
    expect(signature).toHaveLength(64)
    expect(
      verify(
        'sha256',
        Buffer.from(signatureBase(SIGNATURE_INPUT)),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        signature,
      ),
    ).toBe(true)
  })

  it('refuses a key that is not P-256', async () => {
    const k256 = await Secp256k1Keypair.create()
    await expect(signedHeaders(k256)).rejects.toThrow(/must be a P-256 did:key/)
  })
})

describe(verifyCredentialSig, () => {
  it('verifies its own signature', async () => {
    await expect(
      verifyCredentialSig(await signedHeaders(), keyId),
    ).resolves.toBeUndefined()
  })

  it('accepts a high-S signature', async () => {
    const headers = await signedHeaders()
    const sig = Buffer.from(signatureBytes(headers.signature as string))
    const order =
      0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n
    const lowS = BigInt(`0x${sig.subarray(32).toString('hex')}`)
    expect(lowS < order / 2n).toBe(true)
    Buffer.from((order - lowS).toString(16).padStart(64, '0'), 'hex').copy(
      sig,
      32,
    )
    headers.signature = `sig=:${sig.toString('base64')}:`
    await expect(verifyCredentialSig(headers, keyId)).resolves.toBeUndefined()
  })

  it('finds the signature by its tag under any label, with extra parameters', async () => {
    const params = `("authorization" "atproto-space-audience");alg="ecdsa-p256-sha256";created=1618884473;keyid="${keyId}";tag="atproto-space-credential"`
    const sig = await key.sign(Buffer.from(signatureBase(params)))
    const headers = {
      authorization: AUTHORIZATION,
      'atproto-space-audience': AUDIENCE,
      'signature-input': `other=("authorization");keyid="other", custom=${params}`,
      signature: `other=:YWJj:, custom=:${toBase64(sig)}:`,
    }
    await expect(verifyCredentialSig(headers, keyId)).resolves.toBeUndefined()
  })

  it('ignores whitespace around covered values', async () => {
    const headers = await signedHeaders()
    headers.authorization = ` ${AUTHORIZATION}  `
    await expect(verifyCredentialSig(headers, keyId)).resolves.toBeUndefined()
  })

  it.each(['authorization', 'atproto-space-audience'])(
    'rejects a changed %s',
    async (name) => {
      const headers = await signedHeaders()
      headers[name] += '-changed'
      await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
        /invalid HTTP message signature/,
      )
    },
  )

  it.each([
    {
      note: 'a missing authorization',
      headers: { authorization: undefined },
      message: /missing or malformed "authorization" field/,
    },
    {
      note: 'a multi-valued audience',
      headers: { 'atproto-space-audience': [AUDIENCE, AUDIENCE] },
      message: /missing or malformed "atproto-space-audience" field/,
    },
    {
      note: 'a missing signature-input',
      headers: { 'signature-input': undefined },
      message: /missing or malformed signature headers/,
    },
  ])('rejects $note', async ({ headers, message }) => {
    await expect(
      verifyCredentialSig({ ...(await signedHeaders()), ...headers }, keyId),
    ).rejects.toThrow(message)
  })

  it.each([
    { note: 'no', params: '' },
    { note: 'another', params: ';tag="other"' },
  ])('rejects $note tag', async ({ params }) => {
    const headers = await signedHeaders()
    headers['signature-input'] = `sig=${SIGNATURE_INPUT.replace(
      ';tag="atproto-space-credential"',
      params,
    )}`
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /missing or malformed signature with tag "atproto-space-credential"/,
    )
  })

  it('rejects more than one signature with the tag', async () => {
    const headers = await signedHeaders()
    for (const name of ['signature-input', 'signature']) {
      headers[name] +=
        `, ${(headers[name] as string).replace(/^sig=/, 'other=')}`
    }
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /more than one signature with tag "atproto-space-credential"/,
    )
  })

  it.each([
    {
      note: 'are reversed',
      components: '("atproto-space-audience" "authorization")',
    },
    { note: 'omit the audience', components: '("authorization")' },
    {
      note: 'carry a parameter',
      components: '("authorization";sf "atproto-space-audience")',
    },
  ])('rejects covered components that $note', async ({ components }) => {
    const headers = await signedHeaders()
    headers['signature-input'] =
      `sig=${components};tag="atproto-space-credential"`
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /must cover exactly/,
    )
  })

  it('rejects signature input that does not parse', async () => {
    const headers = await signedHeaders()
    headers['signature-input'] = 'sig=("authorization"'
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /missing or malformed signature headers/,
    )
  })

  it('rejects a signature whose parameters changed', async () => {
    const headers = await signedHeaders()
    headers['signature-input'] += ';alg="ecdsa-p256-sha256"'
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /invalid HTTP message signature/,
    )
  })

  it('rejects another algorithm', async () => {
    const headers = await signedHeaders()
    headers['signature-input'] += ';alg="ecdsa-p384-sha384"'
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /signature algorithm must be ecdsa-p256-sha256/,
    )
  })

  it('rejects a keyid other than the credential key', async () => {
    const other = await P256Keypair.create()
    const headers = await signedHeaders()
    headers['signature-input'] += `;keyid="${other.did()}"`
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /keyid does not match the expected key/,
    )
  })

  it('rejects another signing key', async () => {
    const other = await P256Keypair.create()
    await expect(
      verifyCredentialSig(await signedHeaders(other), keyId),
    ).rejects.toThrow(/invalid HTTP message signature/)
  })

  it('rejects a credential key that is not P-256', async () => {
    const k256 = await Secp256k1Keypair.create()
    await expect(
      verifyCredentialSig(await signedHeaders(), k256.did() as DidString),
    ).rejects.toThrow(/must be a P-256 did:key/)
  })

  it('rejects a signature that is not a byte sequence', async () => {
    const headers = await signedHeaders()
    headers.signature = 'sig=not-a-byte-sequence'
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /missing or malformed signature with tag/,
    )
  })

  it('rejects a DER-encoded signature', async () => {
    const headers = await signedHeaders()
    const compact = signatureBytes(headers.signature as string)
    const integers = [compact.slice(0, 32), compact.slice(32)].flatMap(
      (value) => {
        const bytes = value[0] & 0x80 ? [0, ...value] : [...value]
        return [2, bytes.length, ...bytes]
      },
    )
    const der = new Uint8Array([0x30, integers.length, ...integers])
    headers.signature = `sig=:${toBase64(der)}:`
    await expect(verifyCredentialSig(headers, keyId)).rejects.toThrow(
      /invalid HTTP message signature/,
    )
  })
})
