import cmd from '../../lib/command.js'

export default cmd({
  name: 'list likes',
  category: 'interactions',
  help: 'List all of the likes on a post.',
  args: [
    {name: 'id', type: 'string'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})