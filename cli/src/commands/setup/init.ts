import prompt from 'prompt'
import cmd from '../../lib/command.js'
import { REPO_PATH } from '../../lib/env.js'
import * as config from '../../lib/config.js'
import { loadDelegate } from '../../lib/client.js'

prompt.colors = false
prompt.message = ''

export default cmd({
  name: 'init',
  category: 'setup',
  help: 'Create a new scdb repo.',
  opts: [
    { name: 'server', type: 'string', default: '' },
    { name: 'username', type: 'string', default: '' },
    { name: 'register', type: 'boolean', default: false },
  ],
  async command(args) {
    let { username, server, register } = args

    console.log(`Repo path: ${REPO_PATH}`)
    if (!username || !server) {
      console.log(`This utility will initialize your sky repo.`)
      console.log(`Press ^C at any time to quit.`)
      prompt.start()
      username = (
        await prompt.get({
          description: 'Username',
          type: 'string',
          pattern: /^[a-z0-9-]+$/i,
          message: 'Name must be only letters, numbers, or dashes',
          required: true,
          default: username || '',
        })
      ).question
      server = (
        await prompt.get({
          description: 'Server',
          type: 'string',
          required: true,
          default: server || '',
        })
      ).question
      register = (
        await prompt.get({
          description: 'Register with the server?',
          type: 'boolean',
          required: true,
          default: true,
        })
      ).question
    }

    console.log('Generating repo...')

    const serverCleaned = server.replace('http://', '').replace('https://', '')

    await config.writeCfg(REPO_PATH, username, server)
    const client = await loadDelegate(REPO_PATH)

    if (register) {
      console.log('Registering with server...')
      try {
        await client.register(username)
      } catch (e) {
        console.error(`Failed to register with server`)
        throw e
      }
    } else {
      console.log('Skipping registration')
    }

    console.log('')
    console.log(`Repo created at ${REPO_PATH}`)
    console.log(`DID: ${client.did}`)
  },
})
