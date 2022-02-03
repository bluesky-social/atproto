import cmd from '../../lib/command.js'

export default cmd({
  name: 'unfollow',
  category: 'social',
  help: 'Unfollow the given user.',
  args: [
    {name: 'id', type: 'string'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})