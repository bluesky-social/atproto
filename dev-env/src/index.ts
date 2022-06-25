import http from 'http'
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
import { ServerConfig, StartParams } from './types.js'

export class DevEnv {
  personalDataServer: http.Server[] = []
  webSocketRelay: http.Server[] = []
  didWebHost: DidWebServer[] = []
  keyManager: http.Server[] = []
  authLobby: http.Server[] = []
  exampleApp: http.Server[] = []

  static async create(params: StartParams): Promise<DevEnv> {
    const devEnv = new DevEnv()
    for (const cfg of params.personalDataServer || []) {
      await devEnv.startPersonalDataSever(cfg)
    }
    for (const cfg of params.webSocketRelay || []) {
      await devEnv.startWebSocketRelay(cfg)
    }
    for (const cfg of params.didWebHost || []) {
      await devEnv.startDidWebHost(cfg)
    }
    for (const cfg of params.keyManager || []) {
      await devEnv.startKeyManager(cfg)
    }
    for (const cfg of params.authLobby || []) {
      await devEnv.startAuthLobby(cfg)
    }
    for (const cfg of params.exampleApp || []) {
      await devEnv.startExampleApp(cfg)
    }
    return devEnv
  }

  async startPersonalDataSever(cfg: ServerConfig) {
    const db = PDSDatabase.memory()
    const serverBlockstore = IpldStore.createInMemory()
    const inst = await onServerReady(
      PDSServer(serverBlockstore, db, cfg.port),
      '🌞 ADX Data server',
    )
    this.personalDataServer.push(inst)
  }

  async startWebSocketRelay(cfg: ServerConfig) {
    const inst = await onServerReady(WSRelayServer(cfg.port), '🔁 Relay server')
    this.webSocketRelay.push(inst)
  }

  async startDidWebHost(cfg: ServerConfig) {
    const db = DidWebDb.memory()
    const inst = DidWebServer.create(db, cfg.port)
    if (inst._httpServer) {
      await onServerReady(inst._httpServer, '📰 did:web server')
      this.didWebHost.push(inst)
    } else {
      throw new Error(
        `did:web server at port ${cfg.port} failed to start a server`,
      )
    }
  }

  async startKeyManager(cfg: ServerConfig) {
    const db = KeyManagerDb.memory()
    const inst = await onServerReady(
      KeyManagerServer(db, cfg.port),
      '🔑 Key management server',
    )
    this.keyManager.push(inst)
  }

  async startAuthLobby(cfg: ServerConfig) {
    const inst = await onServerReady(AuthLobbyServer(cfg.port), '🧘 Auth lobby')
    this.authLobby.push(inst)
  }

  async startExampleApp(cfg: ServerConfig) {
    const inst = await onServerReady(ExampleApp(cfg.port), '💻 Example app')
    this.exampleApp.push(inst)
  }

  async close(inst: http.Server | DidWebServer) {
    if (inst instanceof DidWebServer) {
      if (inst._httpServer) {
        await closeServer(inst._httpServer)
      }
    } else {
      await closeServer(inst)
    }
  }

  async closeAll() {
    const close = this.close.bind(this)
    await Promise.all(this.personalDataServer.map(close))
    await Promise.all(this.webSocketRelay.map(close))
    await Promise.all(
      this.didWebHost.map((inst) =>
        inst._httpServer ? close(inst._httpServer) : undefined,
      ),
    )
    await Promise.all(this.keyManager.map(close))
    await Promise.all(this.authLobby.map(close))
    await Promise.all(this.exampleApp.map(close))
  }
}

export function getUrl(s: http.Server) {
  const addr = s.address()
  const url =
    typeof addr === 'string'
      ? addr
      : addr
      ? `http://localhost:${addr.port}`
      : '<unknown>'
  return url
}

export function getServerPort(s: http.Server) {
  const addr = s.address()
  return addr && typeof addr === 'object' ? addr.port : 0
}

function onServerReady(s: http.Server, name: string): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    s.on('listening', () => {
      console.log(`${name} running at ${getUrl(s)}`)
      resolve(s)
    })
    s.on('error', (e: Error) => {
      console.log(`${name} failed to start:`, e)
      reject(e)
    })
  })
}

function closeServer(s: http.Server): Promise<void> {
  return new Promise((resolve) => {
    console.log(`Closing ${getUrl(s)}`)
    s.close(() => resolve())
  })
}
