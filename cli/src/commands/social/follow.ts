import cmd from '../../lib/command.js'

export default cmd({
  name: 'follow',
  category: 'social',
  help: 'Follow the given user.',
  args: [
    {name: 'id', type: 'string'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})