const Ajv = require('ajv')
const ajvAddFormats = require('ajv-formats')
const { readAll } = require('./_util')

const ajv = new Ajv()
ajvAddFormats(ajv)

const schemas = readAll()
for (const schema of schemas) {
  // TODO use schemas package for this
  if (schema.params) {
    try {
      ajv.compile(schema.params)
    } catch (e) {
      console.error(`${schema.name} has an invalid .params`)
      throw e
    }
  }
  if (schema.response) {
    try {
      testExamples(ajv.compile(schema.response), schema)
    } catch (e) {
      console.error(`${schema.name} has an invalid .response`)
      throw e
    }
  }
  if (schema.schema) {
    try {
      testExamples(ajv.compile(schema.schema), schema)
    } catch (e) {
      console.error(`${schema.name} has an invalid .schema`)
      throw e
    }
  }
}

function testExamples(validate, schema) {
  const examples = schema.$ext?.['adxs-doc']?.examples || []
  for (const example of examples) {
    if (!validate(example)) {
      console.error(`Example failed validation`, example)
      console.error(validate.errors)
      process.exit(1)
    }
  }
}
