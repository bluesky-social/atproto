import cmd from '../lib/command.js'

export default cmd({
  name: 'hello',
  category: 'advanced',
  help: 'Say hello to somebody',
  args: [{name: 'who', optional: true}],
  opts: [
    {name: 'loud', abbr: 'l', type: 'boolean', default: false, help: 'Make sure everybody can hear you.'},
    {name: 'delay', type: 'number', default: 0, help: 'Wait this many milliseconds before speaking.'}
  ],
  async command (args) {
    let str = `hello ${args._[0] || 'world'}`
    if (args.loud) str = str.toUpperCase()
    if (args.delay) {
      console.log('Delaying', args.delay, 'ms')
      await new Promise(r => setTimeout(r, args.delay))
    }
    console.log(str)
  }
})