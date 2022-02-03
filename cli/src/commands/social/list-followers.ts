import cmd from '../../lib/command.js'

export default cmd({
  name: 'list followers',
  category: 'social',
  help: 'List the followers for the given user (default to self).',
  args: [
    {name: 'id', type: 'string', optional: true}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})