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

import dotenv from 'dotenv'

dotenv.config()

const getPort = (name: string): number | null => {
  const portStr = process.env[name]
  return portStr ? parseInt(portStr) : null
}

const getPorts = (name: string): number[] | null => {
  const portsStr = process.env[name]
  if (!portsStr) return null
  return portsStr.split(',').map((str) => parseInt(str))
}

async function start() {
  const pdsPorts = getPorts('PERSONAL_DATA_SERVERS')
  if (pdsPorts) {
    for (const port of pdsPorts) {
      const db = PDSDatabase.memory()
      const serverBlockstore = IpldStore.createInMemory()
      PDSServer(serverBlockstore, db, port)
    }
  }

  const wsrPort = getPort('WEB_SOCKET_RELAY')
  if (wsrPort) {
    WSRelayServer(wsrPort)
    console.log(`🔁 Relay server running on http://localhost:${wsrPort}`)
  }

  const didPort = getPort('DID_WEB_HOST')
  if (didPort) {
    const db = DidWebDb.memory()
    await DidWebServer.create(db, didPort)
    console.log(`📰 did:web server is running at http://localhost:${didPort}`)
  }

  const kmPort = getPort('KEY_MANAGER')
  if (kmPort) {
    const db = KeyManagerDb.memory()
    KeyManagerServer(db, kmPort)
  }

  const authPorts = getPorts('AUTH_LOBBYS')
  if (authPorts) {
    for (const port of authPorts) {
      init(AuthLobbyServer, port, '🧘 Auth lobby')
    }
  }

  const appPorts = getPorts('EXAMPLE_APPS')
  if (appPorts) {
    for (const port of appPorts) {
      init(ExampleApp, port, '💻 Example app')
    }
  }
}
start()

function init(fn: any, port: number, name: string) {
  const s = fn(port)
  s.on('listening', () => console.log(`${name} running on port ${port}`))
  s.on('error', (e: Error) => console.log(`${name} failed to start:`, e))
}
