import { service } from '@bluesky-demo/common'
import cmd from '../../lib/command.js'
import { Repo } from '../../lib/repo.js'
import { REPO_PATH } from '../../lib/env.js'

export default cmd({
  name: 'follow',
  category: 'social',
  help: 'Follow the given user.',
  args: [
    {name: 'username'}
  ],
  opts: [],
  async command (args) {
    const username = args._[0]
    const repo = await Repo.load(REPO_PATH)

    console.log('Fetching user...')
    const did = await service.fetchUserDid(username)
    if (!did) {
      console.error(`Error: User "${username}" not found`)
      process.exit(1)
    }
    
    console.log('Creating follow...')
    const store = await repo.transact(async store => {
      await store.followUser(username, did)
      return store
    })

    console.log('Uploading to server...')
    await repo.uploadToServer(store)
  }
})