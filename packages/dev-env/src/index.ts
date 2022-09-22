import http from 'http'
import chalk from 'chalk'
import { MemoryBlockstore } from '@adxp/repo'
import PDSServer, {
  DidTestRegistry,
  Database as PDSDatabase,
} from '@adxp/server'
import * as crypto from '@adxp/crypto'
import AdxApi, { ServiceClient } from '@adxp/api'
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
        const db = await PDSDatabase.memory()
        const serverBlockstore = new MemoryBlockstore()
        const keypair = await crypto.EcdsaKeypair.create()
        this.inst = await onServerReady(
          PDSServer(serverBlockstore, db, keypair, {
            debugMode: true,
            scheme: 'http',
            hostname: 'localhost',
            port: this.port,
            didTestRegistry: this.env.didTestRegistry,
          }),
        )
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
    return AdxApi.service(`http://localhost:${this.port}`)
  }
}

export class DevEnv {
  servers: Map<number, DevEnvServer> = new Map()
  didTestRegistry = new DidTestRegistry()

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
    }
    const server = new DevEnvServer(this, cfg.type, cfg.port)
    await server.start()
    this.servers.set(cfg.port, server)
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
