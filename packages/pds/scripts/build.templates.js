import {
  globSync,
  mkdirSync,
  readFileSync,
  watch,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import Handlebars from 'handlebars'

const SRC_DIR = 'src/mailer/templates'
const OUT_DIR = 'dist/mailer/templates'

/**
 * Precompile a single `.hbs` template into an ES module exporting a runtime
 * template function, alongside its source map.
 *
 * @param {string} src - path to the `.hbs` file
 */
function buildTemplate(src) {
  const name = basename(src, '.hbs')
  const jsPath = join(OUT_DIR, `${name}.js`)
  const mapPath = join(OUT_DIR, `${name}.js.map`)

  const input = readFileSync(src, 'utf8')
  const { code, map } = Handlebars.precompile(input, {
    srcName: basename(src),
    destName: `${name}.js`,
  })

  const module =
    `import Handlebars from 'handlebars'\n` +
    `export default Handlebars.template(${code})\n` +
    `//# sourceMappingURL=${name}.js.map\n`

  writeFileSync(jsPath, module)
  writeFileSync(mapPath, map)

  console.log(`  ${jsPath}`)
}

mkdirSync(OUT_DIR, { recursive: true })

const sources = globSync(`${SRC_DIR}/**/*.hbs`)
for (const src of sources) buildTemplate(src)
console.log(`Built ${sources.length} template(s)`)

if (process.argv.includes('--watch')) {
  console.log(`Watching ${SRC_DIR} for changes...`)
  watch(SRC_DIR, { recursive: true }, (_event, filename) => {
    if (filename && filename.endsWith('.hbs')) {
      try {
        buildTemplate(join(SRC_DIR, filename))
      } catch (err) {
        console.error(`Failed to build ${filename}:`, err)
      }
    }
  })
}
