import http from 'http'
import chalk from 'chalk'
import { IpldStore } from '@adxp/common'
import PDSServer from '@adxp/server/dist/server.js'
import PDSDatabase from '@adxp/server/dist/db/index.js'
import WSRelayServer from '@adxp/ws-relay/dist/index.js'
// @ts-ignore
import AuthLobbyServer from '@adxp/auth-lobby'
// @ts-ignore
import ExampleApp from '@adxp/example-app'
import { DidWebDb, DidWebServer } from '@adxp/did-sdk'
import KeyManagerServer from './key-manager/index.js'
import KeyManagerDb from './key-manager/db.js'
import { ServerType, ServerConfig, StartParams } from './types.js'

class DevEnvServer {
  inst?: http.Server | DidWebServer

  constructor(public type: ServerType, public port: number) {}

  get name() {
    return {
      [ServerType.PersonalDataServer]: '🌞 ADX Data server',
      [ServerType.WebSocketRelay]: '🔁 Relay server',
      [ServerType.DidWebHost]: '📰 did:web server',
      [ServerType.KeyManager]: '🔑 Key management server',
      [ServerType.AuthLobby]: '🧘 Auth lobby',
      [ServerType.ExampleApp]: '💻 Example app',
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
          console.log(`${this.name} running at ${this.url}`)
          resolve(s)
        })
        s.on('error', (e: Error) => {
          console.log(`${this.name} failed to start:`, e)
          reject(e)
        })
      })
    }

    switch (this.type) {
      case ServerType.PersonalDataServer: {
        const db = PDSDatabase.memory()
        const serverBlockstore = IpldStore.createInMemory()
        this.inst = await onServerReady(
          PDSServer(serverBlockstore, db, this.port),
        )
        break
      }
      case ServerType.WebSocketRelay: {
        this.inst = await onServerReady(WSRelayServer(this.port))
        break
      }
      case ServerType.DidWebHost: {
        const db = DidWebDb.memory()
        this.inst = DidWebServer.create(db, this.port)
        if (this.inst._httpServer) {
          await onServerReady(this.inst._httpServer)
        } else {
          throw new Error(
            `did:web server at port ${this.port} failed to start a server`,
          )
        }
        break
      }
      case ServerType.KeyManager: {
        const db = KeyManagerDb.memory()
        this.inst = await onServerReady(KeyManagerServer(db, this.port))
        break
      }
      case ServerType.AuthLobby: {
        this.inst = await onServerReady(AuthLobbyServer(this.port))
        break
      }
      case ServerType.ExampleApp: {
        this.inst = await onServerReady(ExampleApp(this.port))
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

    if (this.inst instanceof DidWebServer) {
      if (this.inst._httpServer) {
        await closeServer(this.inst._httpServer)
      }
    } else if (this.inst) {
      await closeServer(this.inst)
    }
  }
}

export class DevEnv {
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
    }
    const server = new DevEnvServer(cfg.type, cfg.port)
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
}
