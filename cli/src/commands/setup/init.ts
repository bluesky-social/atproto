import prompt from 'prompt'
import { Repo } from '../../lib/repo.js'
import { service } from '@bluesky-demo/common'
import * as ucan from 'ucans'
import cmd from '../../lib/command.js'
import { REPO_PATH } from '../../lib/env.js'

prompt.colors = false
prompt.message = ''

export default cmd({
  name: 'init',
  category: 'setup',
  help: 'Create a new scdb repo.',
  opts: [
    {name: 'server', type: 'string', default: ''},
    {name: 'username', type: 'string', default: ''},
    {name: 'register', type: 'boolean', default: false}
  ],
  async command (args) {
    let {username, server, register} = args

    console.log(` .___   .___ ___.  ___.
/ ___| / ___|  _ \\|  _ \\ 
\\___ \\| |   | | | | |_) |
 ___) | |___| |_| |  __/ 
|____/ \\____|____/|_|`)

    if (!username || !server) {
      console.log(`This utility will initialize your scdp repo.`)
      console.log(`Press ^C at any time to quit.`)
      prompt.start()
      username = (await prompt.get({
        description: 'Username',
        type: 'string',
        pattern: /^[a-z0-9\-]+$/i,
        message: 'Name must be only letters, numbers, or dashes',
        required: true,
        default: username || ''
      })).question
      server = (await prompt.get({
        description: 'Server',
        type: 'string',
        required: true,
        default: server || ''
      })).question
      register = (await prompt.get({
        description: 'Register with the server?',
        type: 'boolean',
        required: true,
        default: true
      })).question
    }

    console.log('Generating repo...')
    const repo = await Repo.createNew(REPO_PATH, username, server)

    if (register) {
      console.log('Registering with server...')
      try {
        // TODO - service needs to use `server`
        const userStore = await repo.getLocalUserStore()
        const blueskyDid = await service.getServerDid()
        const token = await ucan.build({
          audience: blueskyDid,
          issuer: repo.keypair
        })
        await service.register(await userStore.getCarFile(), ucan.encode(token))
      } catch (e: any) {
        console.error(`Failed to register with server`)
        console.error(e.toString())
      }
    } else {
      console.log('Skipping registration')
    }

    console.log('')
    console.log(`Repo created at ${REPO_PATH}`)
    console.log(`DID: ${repo.account.did}`)
  }
})