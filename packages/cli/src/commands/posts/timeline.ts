import chalk from 'chalk'
import cmd from '../../lib/command'
import { loadClient } from '../../lib/client'
import { REPO_PATH } from '../../lib/env'
import { TID } from '@adxp/common'
import { formatDate } from '../../lib/util'

export default cmd({
  name: 'timeline',
  category: 'posts',
  help: 'Retrieve a timeline of users you follow',
  args: [
    { name: 'count', optional: true },
    { name: 'from', optional: true },
  ],
  async command(args) {
    const client = await loadClient(REPO_PATH)
    const countParsed = parseInt(args._[0])
    const count = isNaN(countParsed) ? 100 : countParsed
    const fromStr = args._[1]
    const from = fromStr ? TID.fromStr(fromStr) : undefined
    const timeline = await client.retrieveTimeline(count, from)
    console.log(``)
    for (const post of timeline) {
      console.log(`"${post.text}" - ${post.author_name}`)
      console.log(`Likes: ${post.likes}`)
      console.log(chalk.gray(formatDate(post.time)))
      console.log(chalk.gray(`id: ${post.tid.formatted()}`))
      console.log(``)
    }
  },
})
