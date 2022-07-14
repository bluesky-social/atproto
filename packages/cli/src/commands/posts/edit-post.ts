import cmd from '../../lib/command'
import { loadClient } from '../../lib/client'
import { REPO_PATH } from '../../lib/env'
import { TID } from '@adxp/common'

export default cmd({
  name: 'edit post',
  category: 'posts',
  help: 'Edit an existing post.',
  args: [{ name: 'post_id' }, { name: 'text' }],
  opts: [],
  async command(args) {
    const client = await loadClient(REPO_PATH)
    const tid = TID.fromStr(args._[0])
    const text = args._[1]
    await client.editPost(tid, text)
    console.log('Post edited')
  },
})
