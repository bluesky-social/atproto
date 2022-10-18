import http from 'http'
import chalk from 'chalk'
import crytpo from 'crypto'
import { MemoryBlockstore } from '@atproto/repo'
import PDSServer, { Database as PDSDatabase } from '@atproto/server'
import * as plc from '@atproto/plc'
import * as crypto from '@atproto/crypto'
import AtpApi, { ServiceClient } from '@atproto/api'
import { ServerType, ServerConfig, StartParams } from './types.js'

export class DevEnvServer {
  inst?: http.Server

  constructor(
    private env: DevEnv,
    public type: ServerType,
    public port: number,
  ) {}

  get name() {
    return {
      [ServerType.PersonalDataServer]: '🌞 Personal Data server',
      [ServerType.DidPlaceholder]: '👤 DID Placeholder server',
    }[this.type]
  }

  get description() {
    return `[${chalk.bold(this.port)}] ${this.name}`
  }

  get url() {
    return `http://localhost:${this.port}`
  }

  async start() {
    if (this.inst) {
      throw new Error('Already started')
    }

    const onServerReady = (s: http.Server): Promise<http.Server> => {
      return new Promise((resolve, reject) => {
        s.on('listening', () => {
          console.log(`${this.description} started ${chalk.gray(this.url)}`)
          resolve(s)
        })
        s.on('error', (e: Error) => {
          console.log(`${this.description} failed to start:`, e)
          reject(e)
        })
      })
    }

    switch (this.type) {
      case ServerType.PersonalDataServer: {
        if (!this.env.plcUrl) {
          throw new Error('Must be running a PLC server to start a PDS')
        }

        const db = await PDSDatabase.memory()
        await db.createTables()
        const serverBlockstore = new MemoryBlockstore()
        const keypair = await crypto.EcdsaKeypair.create()

        const plcClient = new plc.PlcClient(this.env.plcUrl)
        const serverDid = await plcClient.createDid(
          keypair,
          keypair.did(),
          'pds.test',
          `http://localhost:${this.port}`,
        )

        this.inst = await onServerReady(
          PDSServer(serverBlockstore, db, keypair, {
            debugMode: true,
            scheme: 'http',
            hostname: 'localhost',
            port: this.port,
            didPlcUrl: this.env.plcUrl,
            serverDid: serverDid,
            testNameRegistry: this.env.testNameRegistry,
            jwtSecret: crytpo.randomBytes(8).toString('base64'),
            appUrlPasswordReset: 'app://password-reset',
            // @TODO setup ethereal.email creds and set emailSmtpUrl here
            emailNoReplyAddress: 'noreply@blueskyweb.xyz',
            adminPassword: 'password',
            inviteRequired: false,
          }).listener,
        )
        break
      }
      case ServerType.DidPlaceholder: {
        const db = await plc.Database.memory().createTables()
        this.inst = await onServerReady(plc.server(db, this.port))
        break
      }
      default:
        throw new Error(`Unsupported server type: ${this.type}`)
    }
  }

  async close() {
    const closeServer = (s: http.Server): Promise<void> => {
      return new Promise((resolve) => {
        console.log(`Closing ${this.description}`)
        s.close(() => resolve())
      })
    }

    if (this.inst) {
      await closeServer(this.inst)
    }
  }

  getClient(): ServiceClient {
    return AtpApi.service(`http://localhost:${this.port}`)
  }
}

export class DevEnv {
  plcUrl: string | undefined
  servers: Map<number, DevEnvServer> = new Map()
  testNameRegistry: Record<string, string> = {}

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
