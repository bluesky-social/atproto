const { safeRun } = require('./run')
function pgClear(pgUri) {
  const schemasCmd = `psql "${pgUri}" -t -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name <> 'information_schema';"`
  const schemas = safeRun(schemasCmd)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const schema of schemas) {
    safeRun(`psql "${pgUri}" -c "DROP SCHEMA \\"${schema}\\" CASCADE;"`)
  }
}

function pgInit(pgUri) {
  safeRun(`psql "${pgUri}" -c "CREATE SCHEMA IF NOT EXISTS \\"public\\";"`)
}

module.exports = {
  pgClear,
  pgInit,
}
