import cmd from '../../lib/command.js'

export default cmd({
  name: 'unlike',
  category: 'interactions',
  help: 'Unlike a post.',
  args: [
    {name: 'id'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})