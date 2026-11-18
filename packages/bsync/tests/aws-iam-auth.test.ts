import assert from 'node:assert'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import net, { type AddressInfo } from 'node:net'
import tls, { type ConnectionOptions, type PeerCertificate } from 'node:tls'
import pg from 'pg'
import {
  pgAwsIamAuthConfig,
  regionFromRdsHostname,
} from '../src/db/aws-iam-auth.js'
import { BsyncService, Database, envToCfg, readEnv } from '../src/index.js'
import fixture from './fixtures/postgres-tls.json' with { type: 'json' }

const RDS_HOST = 'bsync.abc123xyz.us-east-1.rds.amazonaws.com'
const RDS_URL = `postgres://bsync_iam@${RDS_HOST}:5432/bsync`
const rdsCaBundle = readFileSync(
  new URL('../certs/rds-global-bundle.pem', import.meta.url),
  'utf8',
)

describe('AWS IAM database auth', () => {
  describe('configuration', () => {
    it('is off by default', async () => {
      using _ = setEnv({ BSYNC_DB_POSTGRES_AWS_IAM_AUTH: undefined })
      expect(readEnv().dbAwsIamAuth).toBeUndefined()

      const url = 'postgres://pg:password@localhost:5432/postgres'
      const bsync = await createBsync({ dbUrl: url })
      try {
        const { options } = bsync.ctx.db.pool
        expect(options.connectionString).toBe(url)
        expect(options).not.toHaveProperty('ssl')
        expect(options).not.toHaveProperty('password')
      } finally {
        await bsync.ctx.db.close()
      }
    })

    it('is enabled by BSYNC_DB_POSTGRES_AWS_IAM_AUTH', () => {
      using _ = setEnv({ BSYNC_DB_POSTGRES_AWS_IAM_AUTH: 'true' })
      expect(readEnv().dbAwsIamAuth).toBe(true)
    })

    it('refuses to start when the URL has a password', async () => {
      await expect(
        createBsync({
          dbUrl: `postgres://bsync_iam:hunter2@${RDS_HOST}/bsync`,
          dbAwsIamAuth: true,
        }),
      ).rejects.toThrow(/must not contain a password/)
    })

    it.each([
      [`postgres://bsync_iam:hunter2@${RDS_HOST}/bsync`, /password/],
      [`${RDS_URL}?sslmode=require`, /"sslmode" conflicts/],
      [`${RDS_URL}?sslmode=verify-ca`, /"sslmode" conflicts/],
      [`${RDS_URL}?sslmode=no-verify`, /"sslmode" conflicts/],
      [`${RDS_URL}?sslmode=disable`, /"sslmode" conflicts/],
      [`${RDS_URL}?ssl=true`, /"ssl" conflicts/],
      [`${RDS_URL}?sslrootcert=/etc/ca.pem`, /"sslrootcert" conflicts/],
      [`${RDS_URL}?uselibpqcompat=true`, /"uselibpqcompat" conflicts/],
      [`${RDS_URL}?password=hunter2`, /"password" is not supported/],
      [`${RDS_URL}?host=elsewhere`, /"host" is not supported/],
      [`postgres://${RDS_HOST}/bsync`, /must name a user/],
      ['postgres://bsync_iam@%2Fvar%2Frun%2Fpostgresql/bsync', /TCP host/],
      [`mysql://bsync_iam@${RDS_HOST}/bsync`, /scheme/],
      ['not a url', /invalid/],
    ])('refuses %s', (url, error) => {
      let err: unknown
      try {
        pgAwsIamAuthConfig(url, { region: 'us-east-1' })
      } catch (e) {
        err = e
      }
      assert(err instanceof Error)
      expect(err.message).toMatch(error)
      expect(err.message).not.toContain('hunter2')
    })

    it('accepts an IPv6 host', () => {
      const config = pgAwsIamAuthConfig('postgres://bsync_iam@[::1]/bsync', {
        region: 'us-east-1',
      })
      expect(config).toMatchObject({ host: '::1', port: 5432 })
    })

    it('accepts sslmode=verify-full', () => {
      const config = pgAwsIamAuthConfig(`${RDS_URL}?sslmode=verify-full`, {
        region: 'us-east-1',
      })
      expect(config.ssl).toMatchObject({
        ca: rdsCaBundle,
        rejectUnauthorized: true,
      })
    })
  })

  describe('pool options', () => {
    it('verify TLS and use an auth token, whatever the PG* environment says', async () => {
      using _ = setEnv({
        PGSSLMODE: 'disable',
        PGPASSWORD: 'hunter2',
        PGHOST: 'elsewhere',
        PGPORT: '1',
        PGUSER: 'someone',
      })
      const db = new Database({ url: RDS_URL, awsIamAuth: true })
      try {
        expect(db.pool.options).not.toHaveProperty('connectionString')
        // The parameters a pool client connects with, merged by node-postgres
        const client = new pg.Client(db.pool.options)
        expect(client.host).toBe(RDS_HOST)
        expect(client.port).toBe(5432)
        expect(client.user).toBe('bsync_iam')
        expect(client.database).toBe('bsync')
        expect(typeof client.password).toBe('function')
        const ssl = client.ssl as unknown as ConnectionOptions
        expect(ssl.rejectUnauthorized).toBe(true)
        expect(ssl.ca).toBe(rdsCaBundle)
        // checks the configured host, whatever name node passes
        assert(ssl.checkServerIdentity)
        expect(ssl.checkServerIdentity('localhost', certFor(RDS_HOST))).toBe(
          undefined,
        )
        expect(
          ssl.checkServerIdentity(RDS_HOST, certFor('localhost')),
        ).toMatchObject({ code: 'ERR_TLS_CERT_ALTNAME_INVALID' })
      } finally {
        await db.close()
      }
    })
  })

  describe('region', () => {
    it.each([
      [RDS_HOST, 'us-east-1'],
      ['bsync.proxy-abc123xyz.eu-west-2.rds.amazonaws.com', 'eu-west-2'],
      ['bsync.abc123xyz.us-gov-west-1.rds.amazonaws.com', 'us-gov-west-1'],
      ['bsync.abc123xyz.cn-north-1.rds.amazonaws.com.cn', 'cn-north-1'],
      ['BSYNC.ABC123XYZ.AP-SOUTHEAST-2.RDS.AMAZONAWS.COM', 'ap-southeast-2'],
      ['db.example.com', undefined],
      ['rds.amazonaws.com.example.com', undefined],
    ])('derives the region of %s', (host, region) => {
      expect(regionFromRdsHostname(host)).toBe(region)
    })

    it('prefers AWS_REGION', async () => {
      using _ = setEnv({ AWS_REGION: 'eu-central-1' })
      const config = pgAwsIamAuthConfig(RDS_URL, { credentials })
      expect(await getToken(config)).toContain('%2Feu-central-1%2Frds-db%2F')
    })

    it('falls back to the RDS hostname', async () => {
      using _ = setEnv({ AWS_REGION: undefined })
      const config = pgAwsIamAuthConfig(RDS_URL, { credentials })
      expect(await getToken(config)).toContain('%2Fus-east-1%2Frds-db%2F')
    })

    it('refuses to start without a region', () => {
      using _ = setEnv({ AWS_REGION: undefined })
      expect(() =>
        pgAwsIamAuthConfig('postgres://bsync_iam@db.example.com/bsync'),
      ).toThrow(/set AWS_REGION/)
    })
  })

  describe('connections', () => {
    let server: FakePostgres

    beforeAll(async () => {
      server = await startFakePostgres()
    })

    afterAll(async () => {
      await server.close()
    })

    beforeEach(() => {
      server.passwords.length = 0
    })

    it('send a freshly signed token for every new connection', async () => {
      let signings = 0
      const config = pgAwsIamAuthConfig(
        `postgres://bsync_iam@localhost:${server.port}/bsync`,
        {
          region: 'us-west-2',
          ca: fixture.ca,
          credentials: async () => ({
            accessKeyId: `AKIDEXAMPLE${++signings}`,
            secretAccessKey: 'test-secret',
          }),
        },
      )
      const pool = new pg.Pool({ ...config, max: 2 })
      try {
        const a = await pool.connect()
        const b = await pool.connect()
        a.release()
        b.release()
        // reuses an idle connection, without signing
        ;(await pool.connect()).release()
      } finally {
        await pool.end()
      }

      expect(signings).toBe(2)
      expect(server.passwords).toHaveLength(2)
      for (const password of server.passwords) {
        expect(password).toMatch(
          new RegExp(
            `^localhost:${server.port}/\\?Action=connect&DBUser=bsync_iam&.*X-Amz-Credential=AKIDEXAMPLE[12]%2F\\d{8}%2Fus-west-2%2Frds-db%2Faws4_request&.*X-Amz-Expires=900&`,
          ),
        )
      }
      expect(new Set(server.passwords).size).toBe(2)
    })

    it('reject a certificate the RDS CA bundle does not trust', async () => {
      using _ = setEnv({ AWS_REGION: 'us-west-2' })
      const bsync = await createBsync({
        dbUrl: `postgres://bsync_iam@localhost:${server.port}/bsync`,
        dbAwsIamAuth: true,
      })
      try {
        expect(await connectError(bsync.ctx.db.pool)).toMatchObject({
          code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        })
      } finally {
        await bsync.ctx.db.close()
      }
      expect(server.passwords).toHaveLength(0)
    })

    it('reject a certificate for another hostname', async () => {
      const config = pgAwsIamAuthConfig(
        `postgres://bsync_iam@127.0.0.1:${server.port}/bsync`,
        { region: 'us-west-2', ca: fixture.ca, credentials },
      )
      const pool = new pg.Pool(config)
      try {
        // node alone would check the certificate against "localhost"
        expect(await connectError(pool)).toMatchObject({
          code: 'ERR_TLS_CERT_ALTNAME_INVALID',
        })
      } finally {
        await pool.end()
      }
      expect(server.passwords).toHaveLength(0)
    })
  })
})

const credentials = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'test-secret',
}

function certFor(host: string) {
  return {
    subject: { CN: host },
    subjectaltname: `DNS:${host}`,
  } as PeerCertificate
}

async function connectError(pool: pg.Pool): Promise<unknown> {
  return pool.connect().then(
    (client) => client.release(),
    (err: unknown) => err,
  )
}

async function getToken(config: pg.PoolConfig) {
  assert(typeof config.password === 'function')
  return config.password()
}

async function createBsync(env: { dbUrl: string; dbAwsIamAuth?: boolean }) {
  return BsyncService.create(envToCfg({ ...env, apiKeys: ['key-1'] }))
}

function setEnv(vars: Record<string, string | undefined>): Disposable {
  const saved = Object.fromEntries(
    Object.keys(vars).map((key) => [key, process.env[key]]),
  )
  const apply = (values: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  apply(vars)
  return { [Symbol.dispose]: () => apply(saved) }
}

type FakePostgres = {
  port: number
  passwords: string[]
  close: () => Promise<void>
}

// Accepts TLS with the fixture's localhost certificate, asks for a cleartext
// password, records it and accepts the connection.
async function startFakePostgres(): Promise<FakePostgres> {
  const passwords: string[] = []
  const sockets = new Set<net.Socket>()
  const server = net.createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    // SSLRequest
    socket.once('data', () => {
      socket.write('S')
      const secure = new tls.TLSSocket(socket, {
        isServer: true,
        cert: fixture.cert,
        key: fixture.key,
      })
      secure.on('error', () => {})
      let buf = Buffer.alloc(0)
      let started = false
      secure.on('data', (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk])
        for (;;) {
          if (!started) {
            // StartupMessage: no type byte
            if (buf.length < 4 || buf.length < buf.readInt32BE(0)) return
            buf = buf.subarray(buf.readInt32BE(0))
            started = true
            secure.write(authentication(3)) // AuthenticationCleartextPassword
            continue
          }
          if (buf.length < 5 || buf.length < 1 + buf.readInt32BE(1)) return
          const type = String.fromCharCode(buf[0])
          const body = buf.subarray(5, 1 + buf.readInt32BE(1))
          buf = buf.subarray(1 + buf.readInt32BE(1))
          if (type === 'p') {
            passwords.push(body.subarray(0, -1).toString('utf8'))
            secure.write(
              Buffer.concat([
                authentication(0), // AuthenticationOk
                Buffer.from([0x5a, 0, 0, 0, 5, 0x49]), // ReadyForQuery, idle
              ]),
            )
          } else if (type === 'X') {
            secure.end()
          }
        }
      })
    })
  })
  server.listen(0)
  await once(server, 'listening')
  return {
    port: (server.address() as AddressInfo).port,
    passwords,
    close: async () => {
      for (const socket of sockets) socket.destroy()
      server.close()
      await once(server, 'close')
    },
  }
}

function authentication(code: number) {
  const msg = Buffer.alloc(9)
  msg.write('R', 0)
  msg.writeInt32BE(8, 1)
  msg.writeInt32BE(code, 5)
  return msg
}
