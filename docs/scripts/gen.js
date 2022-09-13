const widdershins = require('widdershins')
const yaml = require('yaml')
const fs = require('fs')
const path = require('path')

async function httpRoutes() {
  console.log('Converting http-routes.yml to .md')
  const yamlStr = fs.readFileSync(
    path.join(__dirname, '..', 'specs', 'http-routes.yml'),
    'utf8',
  )
  const md = await widdershins.convert(yaml.parse(yamlStr), {
    search: false,
    language_tabs: [],
    sample: false,
    user_templates: path.join(__dirname, 'http-routes-templates'),
  })
  fs.writeFileSync(
    path.join(__dirname, '..', 'specs', 'http-routes.md'),
    stripFrontMatter(md),
  )
}
httpRoutes()
// widdershins --search false --language_tabs false -o docs/specs/http-routes.md --raw docs/specs/http-routes.yml

function stripFrontMatter(md) {
  const lines = md.split('\n')
  let numDashLines = 0
  let i = 0
  while (numDashLines < 2) {
    if (lines[i].trim() === '---') {
      numDashLines++
    }
    i++
  }
  return lines.slice(i).join('\n')
}
