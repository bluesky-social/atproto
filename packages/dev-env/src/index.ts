import http from 'http'
import chalk from 'chalk'
import crytpo from 'crypto'
import PDSServer, {
  Database as PDSDatabase,
  MemoryBlobStore,
  ServerConfig as PDSServerConfig,
  AppContext as PDSContext,
} from '@atproto/pds'
import * as bsky from '@atproto/bsky'
import * as plc from '@did-plc/lib'
import { PlcServer, Database as PlcDatabase } from '@did-plc/server'
import * as crypto from '@atproto/crypto'
import AtpAgent from '@atproto/api'
import { ServerType, ServerConfig, StartParams, PORTS } from './types.js'
import { HOUR } from '@atproto/common'
import { mockNetworkUtilities } from './test-env'

export * from './test-env'

interface Startable {
  start(): Promise<http.Server>
}

interface Destroyable {
  destroy(): Promise<void>
}

export class DevEnvServer {
  inst?: Destroyable

  constructor(
    private env: DevEnv,
    public type: ServerType,
    public port: number,
  ) {}

  get name() {
    return {
      [ServerType.PersonalDataServer]: '🌞 Personal Data server',
      [ServerType.DidPlaceholder]: '👤 DID Placeholder server',
      [ServerType.BskyAppView]: '🌀 Bsky App View server',
    }[this.type]
  }

  get description() {
    return `[${chalk.bold(this.port)}] ${this.name}`
  }

  get url() {
    return `http://localhost:${this.port}`
  }

  get ctx(): PDSContext | undefined {
    if (this.inst instanceof PDSServer) {
      return this.inst.ctx
    }
  }

  async start() {
    if (this.inst) {
      throw new Error('Already started')
    }

    const startServer = async (server: Startable): Promise<void> => {
      try {
        await server.start()
        console.log(`${this.description} started ${chalk.gray(this.url)}`)
      } catch (err) {
        console.log(`${this.description} failed to start:`, err)
      }
    }

    switch (this.type) {
      case ServerType.PersonalDataServer: {
        if (!this.env.plcUrl) {
          throw new Error('Must be running a PLC server to start a PDS')
        }

        const db = await PDSDatabase.memory()
        await db.migrateToLatestOrThrow()
        const keypair = await crypto.EcdsaKeypair.create()

        const blobstore = new MemoryBlobStore()

        const plcClient = new plc.Client(this.env.plcUrl)
        const serverDid = await plcClient.createDid({
          signingKey: keypair.did(),
          rotationKeys: [keypair.did()],
          handle: 'localhost',
          pds: `http://localhost:${this.port}`,
          signer: keypair,
        })

        const pds = PDSServer.create({
          db,
          blobstore,
          repoSigningKey: keypair,
          plcRotationKey: keypair,
          config: new PDSServerConfig({
            debugMode: true,
            version: '0.0.0',
            scheme: 'http',
            hostname: 'localhost',
            port: this.port,
            didPlcUrl: this.env.plcUrl,
            serverDid,
            recoveryKey: keypair.did(),
            jwtSecret: crytpo.randomBytes(8).toString('base64'),
            availableUserDomains: ['.test'],
            appUrlPasswordReset: 'app://password-reset',
            // @TODO setup ethereal.email creds and set emailSmtpUrl here
            emailNoReplyAddress: 'noreply@blueskyweb.xyz',
            adminPassword: 'password',
            inviteRequired: false,
            userInviteInterval: null,
            imgUriSalt: '9dd04221f5755bce5f55f47464c27e1e',
            imgUriKey:
              'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8',
            privacyPolicyUrl: 'https://example.com/privacy',
            termsOfServiceUrl: 'https://example.com/tos',
            labelerDid: 'did:example:labeler',
            labelerKeywords: {},
            maxSubscriptionBuffer: 200,
            repoBackfillLimitMs: HOUR,
            appViewRepoProvider: process.env.APP_VIEW_REPO_PROVIDER,
          }),
        })
        await startServer(pds)
        this.inst = pds
        break
      }
      case ServerType.DidPlaceholder: {
        const db = PlcDatabase.mock()
        const plcServer = PlcServer.create({ db, port: this.port })
        await startServer(plcServer)
        this.inst = plcServer
        break
      }
      case ServerType.BskyAppView: {
        if (!this.env.pdsUrl || !this.env.plcUrl) {
          throw new Error(
            'Must be running a PDS and PLC servers to start AppView',
          )
        }

        const config = new bsky.ServerConfig({
          version: '0.0.0',
          didPlcUrl: this.env.plcUrl,
          publicUrl: 'https://bsky.public.url',
          imgUriSalt: '9dd04221f5755bce5f55f47464c27e1e',
          imgUriKey:
            'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8',
          adminPassword: 'password',
          labelerDid: 'did:example:labeler',
          dbPostgresUrl: process.env.DB_POSTGRES_URL || '',
          dbPostgresSchema: process.env.DB_POSTGRES_SCHEMA,
          repoProvider: this.env.pdsUrl.replace('http://', 'ws://'),
          port: this.port,
          labelerKeywords: {},
        })

        const db = bsky.Database.postgres({
          url: config.dbPostgresUrl,
          schema: config.dbPostgresSchema,
        })

        await db.migrateToLatestOrThrow()

        const server = bsky.BskyAppView.create({ db, config })
        await startServer(server)
        this.inst = server
        break
      }
      default:
        throw new Error(`Unsupported server type: ${this.type}`)
    }
  }

  async close() {
    if (this.inst) {
      console.log(`Closing ${this.description}`)
      await this.inst.destroy()
    }
  }

  getClient(): AtpAgent {
    return new AtpAgent({ service: `http://localhost:${this.port}` })
  }
}

export class DevEnv {
  plcUrl: string | undefined
  pdsUrl: string | undefined
  servers: Map<number, DevEnvServer> = new Map()

  static async create(params: StartParams): Promise<DevEnv> {
    const devEnv = new DevEnv()
    for (const cfg of params.servers || []) {
      await devEnv.add(cfg)
    }
    return devEnv
  }

  async add(cfg: ServerConfig) {
    if (this.servers.has(cfg.port)) {
      throw new Error(`Port ${cfg.port} is in use`)
    } else if (cfg.type === ServerType.DidPlaceholder && this.plcUrl) {
      throw new Error('There should only be one plc server')
    }
    const server = new DevEnvServer(this, cfg.type, cfg.port)
    await server.start()
    this.servers.set(cfg.port, server)
    if (cfg.type === ServerType.DidPlaceholder) {
      this.plcUrl = `http://localhost:${cfg.port}`
    }
    if (cfg.type === ServerType.PersonalDataServer) {
      this.pdsUrl = `http://localhost:${cfg.port}`
    }
    if (cfg.type === ServerType.BskyAppView) {
      const pds = this.servers.get(PORTS[ServerType.PersonalDataServer])
      if (pds) {
        await mockNetworkUtilities({
          port: pds.port,
          url: pds.url,
          close: pds.close,
          ctx: pds.ctx!,
        })
      }
    }
  }

  async remove(server: number | DevEnvServer) {
    const port = typeof server === 'number' ? server : server.port
    const inst = this.servers.get(port)
    if (inst) {
      await inst.close()
      this.servers.delete(port)
    }
  }

  async shutdown() {
    for (const server of this.servers.values()) {
      await server.close()
    }
  }

  hasType(type: ServerType) {
    for (const s of this.servers.values()) {
      if (s.type === type) {
        return true
      }
    }
    return false
  }

  listOfType(type: ServerType): DevEnvServer[] {
    return Array.from(this.servers.values()).filter((s) => s.type === type)
  }
}
