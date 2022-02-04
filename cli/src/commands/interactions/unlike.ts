import cmd from '../../lib/command.js'

export default cmd({
  name: 'unlike',
  category: 'interactions',
  help: 'Unlike a post.',
  args: [
    {name: 'id', type: 'string'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})