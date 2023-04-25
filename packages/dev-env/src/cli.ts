import assert from 'assert'
import repl from 'repl'
import fs from 'fs'
import os from 'os'
import { join } from 'path'
import chalk from 'chalk'
import { DevEnv, DevEnvServer } from './index.js'
import * as env from './env.js'
import { ServerType } from './types.js'
import { genServerCfg } from './util'
import { generateMockSetup } from './mock'

const pkg = JSON.parse(
  fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
)

let devEnv: DevEnv | undefined
const users: Map<string, DevEnvServer> = new Map()

// commands
// =

const envApi = {
  get env() {
    return devEnv
  },

  get api() {
    const client = devEnv
      ?.listOfType(ServerType.PersonalDataServer)[0]
      .getClient()
    if (!client) {
      throw new Error('No PDS is active')
    }
    return client
  },

  status() {
    assert(devEnv)
    console.log(chalk.bold(' port  server'))
    for (const server of devEnv.servers.values()) {
      console.log(`${server.description} ${chalk.gray(server.url)}`)
    }
  },

  async startPds(port?: number) {
    assert(devEnv)
    await devEnv.add(await genServerCfg(ServerType.PersonalDataServer, port))
  },

  async startBsky(port?: number) {
    assert(devEnv)
    await devEnv.add(await genServerCfg(ServerType.BskyAppView, port))
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

  async mkuser(handle: string, serverPort?: number) {
    assert(devEnv)
    assert(handle && typeof handle === 'string', 'Handle is required')

    if (!handle.endsWith('.test')) {
      handle += '.test'
    }
    if (users.has(handle)) {
      throw new Error(`${handle} already exists`)
    }
    const handleNoTld = handle.slice(0, handle.length - '.test'.length)

    const servers = devEnv.listOfType(ServerType.PersonalDataServer)
    let pds: DevEnvServer
    if (!serverPort) {
      if (servers.length > 0) {
        pds = servers[0]
      } else {
        throw new Error('Start a PDS first')
      }
    } else {
      const inst = servers.find((s) => s.port === serverPort)
      if (!inst) throw new Error(`No PDS running on port ${serverPort}`)
      pds = inst
    }

    console.log(`Creating ${handle} on ${pds.description}`)

    // create the PDS account
    const client = pds.getClient()
    const pdsRes = await client.api.com.atproto.server.createAccount({
      email: handleNoTld + '@test.com',
      handle,
      password: handleNoTld + '-pass',
    })
    users.set(handle, pds)
  },

  user(handle: string) {
    const pds = users.get(handle)
    if (!pds) throw new Error('User not found')
    return pds.getClient()
  },
}

// start
// =

console.log(`
██████╗
██╔═══██╗
██║██╗██║
██║██║██║
╚█║████╔╝
 ╚╝╚═══╝  protocol

[  v${pkg.version}  | created by Bluesky ]

Initializing...`)
async function start() {
  devEnv = await DevEnv.create(env.load())
  await generateMockSetup(devEnv)
  console.log('Test environment generated.')
  console.log('Type .help if you get lost')

  // create repl
  const inst = repl.start() //'atp $ ')
  Object.assign(inst.context, envApi)
  inst.setupHistory(join(os.homedir(), '.atp-dev-env-history'), () => {})
  inst.on('exit', async () => {
    console.log(`Shutting down...`)
    await devEnv?.shutdown()
    process.exit(0)
  })

  return inst
}
start()
