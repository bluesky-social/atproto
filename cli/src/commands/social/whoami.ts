import cmd from '../../lib/command.js'

export default cmd({
  name: 'whoami',
  category: 'social',
  help: 'Display the profile of the local user.',
  args: [],
  opts: [],
  async command (args) {
    throw new Error('TODO')
  }
})