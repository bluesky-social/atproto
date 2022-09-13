import repl, { REPLServer } from 'repl'
import fs from 'fs'
import os from 'os'
import { join } from 'path'
import chalk from 'chalk'
import inquirer from 'inquirer'
import getPort, { portNumbers } from 'get-port'
import { DevEnv, DevEnvServer } from './index.js'
import * as env from './env.js'
import { PORTS, ServerType, ServerConfig, SERVER_TYPE_LABELS } from './types.js'

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
let isReplPaused = false
const users: Map<string, DevEnvServer> = new Map()
async function start() {
  const devEnv = await DevEnv.create(env.load())
  createREPL(devEnv)
}
start()

// commands
// =

async function createREPL(devEnv: DevEnv): Promise<REPLServer> {
  let inst = repl.start('adx $ ')
  inst.context.env = devEnv
  inst.context.user = (name: string) => {
    const pds = users.get(name)
    if (!pds) throw new Error('User not found')
    return pds.getClient(`did:example:${name}`)
  }
  inst.setupHistory(join(os.homedir(), '.adx-dev-env-history'), () => {})
  inst.on('exit', async () => {
    if (!isReplPaused) {
      console.log(`Shutting down...`)
      await devEnv.shutdown()
      process.exit()
    }
  })

  inst.defineCommand('status', {
    help: 'List active servers.',
    async action() {
      this.clearBufferedCommand()
      console.log(chalk.bold(' port  server'))
      for (const server of devEnv.servers.values()) {
        console.log(`${server.description} ${chalk.gray(server.url)}`)
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

  inst.defineCommand('mkuser', {
    help: 'Create a new user.',
    async action() {
      this.clearBufferedCommand()
      if (!devEnv.hasType(ServerType.PersonalDataServer)) {
        console.error('You must run a personal data server.')
      } else {
        inst = await pauseREPL(inst, devEnv, async () => {
          const pds = await promptChooseServer(
            devEnv,
            ServerType.PersonalDataServer,
          )

          const username = await promptGeneral('Choose a username:')
          console.log(`Creating ${username} on ${pds.description}`)

          // create the PDS account
          const client = pds.getClient(`did:example:${username}`)
          const pdsRes = await client.register(username)
          users.set(username, pds)
        })
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

async function promptChooseServer(
  devEnv: DevEnv,
  type: ServerType,
): Promise<DevEnvServer> {
  const servers = devEnv.listOfType(type)
  if (servers.length === 1) {
    return servers[0]
  }
  const label = SERVER_TYPE_LABELS[type]
  const res = await inquirer.prompt({
    name: 'server',
    type: 'list',
    message: `Which ${label} do you want to use?`,
    choices: servers.map((s) => ({ name: s.description, value: s })),
  })
  return res.server
}

async function promptGeneral(message: string, fallback?: string) {
  const res = await inquirer.prompt({
    name: 'general',
    type: 'input',
    message,
    default: fallback,
  })
  return res.general
}

// NOTE
// This is required because NodeJS doesn't support multiple readline consumers at once.
// If you need to do something with readline (like use Inquirer) then do so within a closure
// passed into this function.
// -prf
async function pauseREPL(
  inst: REPLServer,
  env: DevEnv,
  fn: () => Promise<void>,
): Promise<REPLServer> {
  isReplPaused = true
  const p = new Promise((r) => inst.once('exit', r))
  inst.close()
  await p
  await fn()
  inst = await createREPL(env)
  isReplPaused = false
  return inst
}
