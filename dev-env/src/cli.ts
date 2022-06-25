import repl, { REPLServer } from 'repl'
import fs, { promises as fsp } from 'fs'
import os from 'os'
import http from 'http'
import { DidWebServer } from '@adxp/did-sdk'
import util from 'util'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import minimist from 'minimist'
import getPort, { portNumbers } from 'get-port'
import { DevEnv, getServerPort } from './index.js'
import * as env from './env.js'
import { PORTS, ServerConfig } from './types.js'

const __dirname = join(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(
  fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
)

// start
// =

banner()
const devEnv = await DevEnv.create(env.load())
console.log('Type .help if you get lost')
const replInst = createREPL()

// commands
// =

function createREPL(): REPLServer {
  const inst = repl.start('adx $ ')
  inst.setupHistory(join(os.homedir(), '.adx-dev-env-history'), () => {})
  inst.on('exit', async () => {
    await reset()
    process.exit()
  })

  inst.defineCommand('status', {
    help: 'List active servers.',
    async action() {
      this.clearBufferedCommand()
      for (const inst of devEnv.personalDataServer) {
        console.log('• Personal Data Server [', getServerPort(inst), ']')
      }
      for (const inst of devEnv.webSocketRelay) {
        console.log('• Web Socket Relay [', getServerPort(inst), ']')
      }
      for (const inst of devEnv.didWebHost) {
        if (inst._httpServer) {
          console.log('• did:web Host [', getServerPort(inst._httpServer), ']')
        }
      }
      for (const inst of devEnv.keyManager) {
        console.log('• Key Manager [', getServerPort(inst), ']')
      }
      for (const inst of devEnv.authLobby) {
        console.log('• Auth Lobby [', getServerPort(inst), ']')
      }
      for (const inst of devEnv.exampleApp) {
        console.log('• Example App [', getServerPort(inst), ']')
      }
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-pds', {
    help: 'Start a personal data server.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.startPersonalDataSever(
        await cfg(port, PORTS.PERSONAL_DATA_SERVER),
      )
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-wsr', {
    help: 'Start a websocket relay.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.startWebSocketRelay(await cfg(port, PORTS.WEB_SOCKET_RELAY))
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-did-web-host', {
    help: 'Start a did:web host.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.startDidWebHost(await cfg(port, PORTS.DID_WEB_HOST))
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-key-manager', {
    help: 'Start a key manager.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.startKeyManager(await cfg(port, PORTS.KEY_MANAGER))
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-auth-lobby', {
    help: 'Start an auth lobby.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.startAuthLobby(await cfg(port, PORTS.AUTH_LOBBY))
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-example-app', {
    help: 'Start an example app.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.startExampleApp(await cfg(port, PORTS.EXAMPLE_APP))
      this.displayPrompt()
    },
  })

  inst.defineCommand('kill', {
    help: 'Kill the server at the given port.',
    async action(portStr: string) {
      this.clearBufferedCommand()
      const inst = findInst(parseInt(portStr))
      if (!inst) {
        if (!parseInt(portStr)) {
          console.error(
            'You must supply the port number of the server to kill.',
          )
        } else {
          console.error('No server found at port', portStr)
        }
      } else {
        if (inst instanceof DidWebServer) {
          if (inst._httpServer) {
            await devEnv.close(inst._httpServer)
          }
        } else {
          await devEnv.close(inst)
        }
        removeInst(inst)
      }
      this.displayPrompt()
    },
  })

  return inst
}

// helpers
// =

function banner() {
  console.log(`
  █████╗ ██████╗ ██╗  ██╗
  ██╔══██╗██╔══██╗╚██╗██╔╝
  ███████║██║  ██║ ╚███╔╝ 
  ██╔══██║██║  ██║ ██╔██╗ 
  ██║  ██║██████╔╝██╔╝ ██╗
  ╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝

[  v${pkg.version}  | created by Bluesky ]
`)
}

async function reset() {
  if (devEnv) {
    console.log(`Shutting down`)
    await devEnv.closeAll()
  }
}

async function cfg(portStr: string, basePort: number): Promise<ServerConfig> {
  return {
    port:
      parseInt(portStr) ||
      (await getPort({ port: portNumbers(basePort, 65535) })),
  }
}

function findInst(port: number) {
  for (const inst of devEnv.personalDataServer) {
    if (getServerPort(inst) === port) {
      return inst
    }
  }
  for (const inst of devEnv.webSocketRelay) {
    if (getServerPort(inst) === port) {
      return inst
    }
  }
  for (const inst of devEnv.didWebHost) {
    if (inst._httpServer && getServerPort(inst._httpServer) === port) {
      return inst
    }
  }
  for (const inst of devEnv.keyManager) {
    if (getServerPort(inst) === port) {
      return inst
    }
  }
  for (const inst of devEnv.authLobby) {
    if (getServerPort(inst) === port) {
      return inst
    }
  }
  for (const inst of devEnv.exampleApp) {
    if (getServerPort(inst) === port) {
      return inst
    }
  }
}

function removeInst(inst: http.Server | DidWebServer) {
  devEnv.personalDataServer = devEnv.personalDataServer.filter(
    (inst2) => inst !== inst2,
  )
  devEnv.webSocketRelay = devEnv.webSocketRelay.filter(
    (inst2) => inst !== inst2,
  )
  devEnv.didWebHost = devEnv.didWebHost.filter((inst2) => inst !== inst2)
  devEnv.keyManager = devEnv.keyManager.filter((inst2) => inst !== inst2)
  devEnv.authLobby = devEnv.authLobby.filter((inst2) => inst !== inst2)
  devEnv.exampleApp = devEnv.exampleApp.filter((inst2) => inst !== inst2)
}
