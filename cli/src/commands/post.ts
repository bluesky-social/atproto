import { service } from '@bluesky-demo/common'
import * as ucan from 'ucans'
import cmd from '../lib/command.js'
import { readRepo, writeRepo } from '../lib/repo.js'
import { REPO_PATH } from '../lib/env.js'

export default cmd({
  name: 'post',
  category: 'social',
  help: 'Create a new post.',
  args: [{name: 'text'}],
  async command (args) {
    const text = args._[0]
    if (!text) {
      console.error(`Error: Post text is required`)
      process.exit(1)
    }

    const repo = await readRepo(REPO_PATH)

    await repo.store.addPost({
      user: repo.account.name,
      text
    })

    console.log('Posting to server...')
    const car = await repo.store.getCarFile()
    const blueskyDid = await service.getServerDid()
    const token = await ucan.build({
      audience: blueskyDid,
      issuer: repo.keypair,
      capabilities: [{
        'bluesky': repo.account.name,
        'cap': 'POST'
      }]
    })
    await service.updateUser(car, ucan.encode(token))

    console.log('Updating local store...')
    await writeRepo(REPO_PATH, repo)
  }
})