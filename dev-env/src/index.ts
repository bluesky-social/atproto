import { IpldStore } from '@adxp/common'
import PDSServer from '@adxp/server/dist/server.js'
import PDSDatabase from '@adxp/server/dist/db/index.js'
import WSRelayServer from '@adxp/ws-relay/dist/index.js'
import { DidWebDb, createDidWebServer } from '@adxp/did-sdk'

type ServiceConfig = {
  personalDataServers?: number[]
  webSocketRelay?: number
  didNetwork?: number
}

const SERVICES: ServiceConfig = {
  personalDataServers: [2583],
  webSocketRelay: 3005,
  didNetwork: 2582,
}

async function start() {
  console.log('Initializing...')

  if (SERVICES.personalDataServers) {
    for (const pdsPort of SERVICES.personalDataServers) {
      const db = PDSDatabase.memory()
      const serverBlockstore = IpldStore.createInMemory()
      PDSServer(serverBlockstore, db, pdsPort)
    }
  }

  if (SERVICES.webSocketRelay) {
    WSRelayServer(SERVICES.webSocketRelay)
    console.log(
      `🔁 Relay server running on http://localhost:${SERVICES.webSocketRelay}`,
    )
  }

  if (SERVICES.didNetwork) {
    const db = DidWebDb.memory()
    await createDidWebServer(db, SERVICES.didNetwork)
    console.log(
      `📰 did:web server is running at http://localhost:${SERVICES.didNetwork}`,
    )
  }
}
start()
