import cmd from '../../lib/command'
import { loadClient } from '../../lib/client'
import { REPO_PATH } from '../../lib/env'

export default cmd({
  name: 'post',
  category: 'posts',
  help: 'Create a new post.',
  args: [{ name: 'text' }],
  async command(args) {
    const text = String(args._[0])
    const client = await loadClient(REPO_PATH)
    const post = await client.addPost(text)
    const tid = post.tid
    console.log(`Created post: `, tid.formatted())
  },
})
