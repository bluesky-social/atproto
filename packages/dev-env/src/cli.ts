import repl, { REPLServer } from 'repl'
import fs from 'fs'
import os from 'os'
import { join } from 'path'
import chalk from 'chalk'
import getPort, { portNumbers } from 'get-port'
import { DevEnv } from './index.js'
import * as env from './env.js'
import { PORTS, ServerType, ServerConfig } from './types.js'

const pkg = JSON.parse(
  fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
)

// start
// =

console.log(`
█████╗ ██████╗ ██╗  ██╗
██╔══██╗██╔══██╗╚██╗██╔╝
███████║██║  ██║ ╚███╔╝ 
██╔══██║██║  ██║ ██╔██╗ 
██║  ██║██████╔╝██╔╝ ██╗
╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝

[  v${pkg.version}  | created by Bluesky ]

Initializing...`)
console.log('Type .help if you get lost')
createREPL()

// commands
// =

async function createREPL(): Promise<REPLServer> {
  const devEnv = await DevEnv.create(env.load())
  const inst = repl.start('adx $ ')
  inst.setupHistory(join(os.homedir(), '.adx-dev-env-history'), () => {})
  inst.on('exit', async () => {
    console.log(`Shutting down...`)
    await devEnv.shutdown()
    process.exit()
  })

  inst.defineCommand('status', {
    help: 'List active servers.',
    async action() {
      this.clearBufferedCommand()
      console.log(chalk.bold(' port  server'))
      for (const server of devEnv.servers.values()) {
        console.log(server.description)
      }
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-pds', {
    help: 'Start a personal data server.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.add(await cfg(port, ServerType.PersonalDataServer))
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-wsrelay', {
    help: 'Start a websocket relay.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.add(await cfg(port, ServerType.WebSocketRelay))
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-didweb', {
    help: 'Start a did:web host.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.add(await cfg(port, ServerType.DidWebHost))
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-keymanager', {
    help: 'Start a key manager.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.add(await cfg(port, ServerType.KeyManager))
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-auth', {
    help: 'Start an auth lobby.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.add(await cfg(port, ServerType.AuthLobby))
      this.displayPrompt()
    },
  })

  inst.defineCommand('start-example-app', {
    help: 'Start an example app.',
    async action(port: string) {
      this.clearBufferedCommand()
      await devEnv.add(await cfg(port, ServerType.ExampleApp))
      this.displayPrompt()
    },
  })

  inst.defineCommand('stop', {
    help: 'Stop the server at the given port.',
    async action(portStr: string) {
      this.clearBufferedCommand()
      const inst = devEnv.servers.get(parseInt(portStr))
      if (!inst) {
        if (!parseInt(portStr)) {
          console.error(
            'You must supply the port number of the server to stop.',
          )
        } else {
          console.error('No server found at port', portStr)
        }
      } else {
        await devEnv.remove(inst)
      }
      this.displayPrompt()
    },
  })

  return inst
}

// helpers
// =

async function cfg(portStr: string, type: ServerType): Promise<ServerConfig> {
  const basePort = PORTS[type]
  return {
    type,
    port:
      parseInt(portStr) ||
      (await getPort({ port: portNumbers(basePort, 65535) })),
  }
}
