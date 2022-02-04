import cmd from '../../lib/command.js'

export default cmd({
  name: 'like',
  category: 'interactions',
  help: 'Like a post.',
  args: [
    {name: 'id'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})