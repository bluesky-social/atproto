import assert from 'assert'
import repl from 'repl'
import fs from 'fs'
import os from 'os'
import { join } from 'path'
import chalk from 'chalk'
import getPort, { portNumbers } from 'get-port'
import { DevEnv, DevEnvServer } from './index.js'
import * as env from './env.js'
import { PORTS, ServerType, ServerConfig } from './types.js'

const pkg = JSON.parse(
  fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
)

let devEnv: DevEnv | undefined
const users: Map<string, DevEnvServer> = new Map()

// commands
// =

const envApi = {
  status() {
    assert(devEnv)
    console.log(chalk.bold(' port  server'))
    for (const server of devEnv.servers.values()) {
      console.log(`${server.description} ${chalk.gray(server.url)}`)
    }
  },

  async startPds(port?: number) {
    assert(devEnv)
    await devEnv.add(await cfg(ServerType.PersonalDataServer, port))
  },

  async stop(port: number) {
    assert(devEnv)
    const inst = devEnv.servers.get(port)
    if (!inst) {
      console.error('No server found at port', port)
    } else {
      await devEnv.remove(inst)
    }
  },

  async mkuser(username: string, serverPort?: number) {
    assert(devEnv)
    assert(username && typeof username === 'string', 'Username is required')

    const servers = devEnv.listOfType(ServerType.PersonalDataServer)
    let pds
    if (!serverPort) {
      if (servers.length > 0) {
        pds = servers[0]
      } else {
        throw new Error('Start a PDS first')
      }
    } else {
      pds = servers.find((s) => s.port === serverPort)
      if (!pds) throw new Error(`No PDS running on port ${serverPort}`)
    }

    console.log(`Creating ${username} on ${pds.description}`)

    // create the PDS account
    const client = pds.getClient(`did:example:${username}`)
    const pdsRes = await client.register(username)
    users.set(username, pds)
  },

  user(name: string) {
    const pds = users.get(name)
    if (!pds) throw new Error('User not found')
    return pds.getClient(`did:example:${name}`)
  },
}

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
async function start() {
  devEnv = await DevEnv.create(env.load())

  // create repl
  let inst = repl.start('adx $ ')
  Object.assign(inst.context, envApi)
  inst.setupHistory(join(os.homedir(), '.adx-dev-env-history'), () => {})
  inst.on('exit', async () => {
    console.log(`Shutting down...`)
    await devEnv?.shutdown()
    process.exit(0)
  })

  return inst
}
start()

// helpers
// =

async function cfg(type: ServerType, port?: number): Promise<ServerConfig> {
  const basePort = PORTS[type]
  return {
    type,
    port: port || (await getPort({ port: portNumbers(basePort, 65535) })),
  }
}
