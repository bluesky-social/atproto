import prompt from 'prompt'
import cmd from '../../lib/command.js'
import { REPO_PATH } from '../../lib/env.js'
import * as config from '../../lib/config.js'
import { loadClient } from '../../lib/client.js'

prompt.colors = false
prompt.message = ''

export default cmd({
  name: 'init',
  category: 'setup',
  help: 'Create a new adx repo.',
  opts: [
    { name: 'server', type: 'string', default: '' },
    { name: 'username', type: 'string', default: '' },
    { name: 'register', type: 'boolean', default: true },
    { name: 'delegator', type: 'boolean', default: false },
  ],
  async command(args) {
    let { username, server, register, delegatorClient } = args

    console.log(`
 █████╗ ██████╗ ██╗  ██╗
██╔══██╗██╔══██╗╚██╗██╔╝
███████║██║  ██║ ╚███╔╝
██╔══██║██║  ██║ ██╔██╗
██║  ██║██████╔╝██╔╝ ██╗
╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝`)

    console.log(`Repo path: ${REPO_PATH}`)

    const exists = await config.cfgExists(REPO_PATH)
    if (exists) {
      console.log('Repo already exists.')
      console.log('To overwrite, run `destroy`.')
      console.log('If unregistered, run `register`.')
      return
    }

    if (!username || !server) {
      console.log(`This utility will initialize your adx repo.`)
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
      register = isYes(
        (
          await prompt.get({
            description: 'Register with the server? [Y/n]',
            type: 'string',
            pattern: /y|yes|n|no/,
            required: true,
            default: 'yes',
          })
        ).question,
      )
      delegatorClient = isYes(
        (
          await prompt.get({
            description:
              'Run a delegator client (and avoid storing repo locally) [y/N]',
            type: 'string',
            pattern: /y|yes|n|no/,
            required: true,
            default: 'no',
          })
        ).question,
      )
    }

    console.log('Generating repo...')
    await config.writeCfg(REPO_PATH, username, server, delegatorClient)
    const client = await loadClient(REPO_PATH)

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

function isYes(v: string | prompt.RevalidatorSchema): boolean {
  return v === 'y' || v === 'yes'
}
