import cmd from '../../lib/command.js'

export default cmd({
  name: 'whois',
  category: 'social',
  help: 'Display the profile of the given user.',
  args: [
    {name: 'id'}
  ],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})