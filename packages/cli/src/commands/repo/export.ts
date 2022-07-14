import cmd from '../../lib/command'
import path from 'path'
import { promises as fsp } from 'fs'
import { loadClient } from '../../lib/client'
import { REPO_PATH } from '../../lib/env'

export default cmd({
  name: 'export',
  category: 'repo',
  help: 'Export repo as a CAR file',
  args: [],
  opts: [],
  async command(args) {
    const client = await loadClient(REPO_PATH)
    const car = await client.export()
    const p = path.join(REPO_PATH, 'export.car')
    await fsp.writeFile(p, car)
    console.log('Exported repo to: ', p)
  },
})
