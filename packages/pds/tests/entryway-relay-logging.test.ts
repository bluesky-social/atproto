import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import type { TestPds, TestPlc } from '@atproto/dev-env'

const ENTRYWAY_DID = 'did:example:entryway'

// The loggers read their configuration when first imported, so everything
// that imports them is loaded dynamically, once logging is enabled.
describe('entryway relay logging', () => {
  let logDir: string
  let logFile: string
  let plc: TestPlc
  let pds: TestPds
  let jwtSigningKey: Secp256k1Keypair
  let otherKey: Keypair

  const relayToken = async (
    clientIp: string,
    keypair: Keypair,
  ): Promise<string> => {
    const b64 = (obj: Record<string, unknown>) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url')
    const iat = Math.floor(Date.now() / 1000)
    const toSign = `${b64({ alg: 'ES256K', typ: 'JWT' })}.${b64({
      iss: ENTRYWAY_DID,
      aud: pds.ctx.cfg.service.did,
      client_ip: clientIp,
      iat,
      exp: iat + 60,
    })}`
    const sig = await keypair.sign(Buffer.from(toSign, 'utf8'))
    return `${toSign}.${Buffer.from(sig).toString('base64url')}`
  }

  const describeServer = (headers: Record<string, string>) =>
    fetch(
      new URL(
        '/xrpc/com.atproto.server.describeServer',
        `http://127.0.0.1:${pds.port}`,
      ),
      { headers },
    )

  // Log lines are written asynchronously, after the response.
  const readLogsUntil = async (predicate: (logs: string) => boolean) => {
    for (let i = 0; i < 50; i++) {
      const logs = await fs.readFile(logFile, 'utf8').catch(() => '')
      if (predicate(logs)) return logs
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('expected log lines were not written')
  }

  beforeAll(async () => {
    logDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pds-relay-logging-'))
    logFile = path.join(logDir, 'pds.log')
    process.env.LOG_ENABLED = 'true'
    process.env.LOG_LEVEL = 'debug'
    process.env.LOG_DESTINATION = logFile

    const { Secp256k1Keypair } = await import('@atproto/crypto')
    const { TestPds, TestPlc } = await import('@atproto/dev-env')

    jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    otherKey = await Secp256k1Keypair.create()
    const plcRotationKey = await Secp256k1Keypair.create()

    plc = await TestPlc.create({})
    pds = await TestPds.create({
      didPlcUrl: plc.url,
      bskyAppViewUrl: undefined,
      bskyAppViewDid: undefined,
      serviceDid: 'did:example:pds',
      entrywayUrl: 'https://entryway.invalid',
      entrywayDid: ENTRYWAY_DID,
      entrywayJwtVerifyKeyK256PublicKeyHex: jwtSigningKey.publicKeyStr('hex'),
      entrywayPlcRotationKey: plcRotationKey.did(),
    })
  })

  afterAll(async () => {
    await pds?.close()
    await plc?.close()
    await fs.rm(logDir, { recursive: true, force: true })
  })

  it('logs neither relay tokens nor client addresses.', async () => {
    const valid = await relayToken('198.51.100.91', jwtSigningKey)
    const invalid = await relayToken('198.51.100.92', otherKey)

    expect((await describeServer({ 'x-entryway-relay': valid })).status).toBe(
      200,
    )
    expect((await describeServer({ 'x-entryway-relay': invalid })).status).toBe(
      200,
    )

    // one access log line per request
    const logs = await readLogsUntil(
      (logs) =>
        logs.split('/xrpc/com.atproto.server.describeServer').length > 2,
    )

    expect(logs.split('"x-entryway-relay":"***"')).toHaveLength(3)
    expect(logs).toContain('"reason":"bad_sig"')
    for (const token of [valid, invalid]) {
      const [, payload, signature] = token.split('.')
      expect(logs).not.toContain(payload)
      expect(logs).not.toContain(signature)
    }
    expect(logs).not.toContain('198.51.100.91')
    expect(logs).not.toContain('198.51.100.92')
  })
})
