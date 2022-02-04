import cmd from '../../lib/command.js'

export default cmd({
  name: 'list follows',
  category: 'social',
  help: 'List the follows for the given user (default to self).',
  args: [
    {name: 'id', optional: true}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})