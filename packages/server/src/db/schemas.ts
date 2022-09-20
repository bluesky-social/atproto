import { RecordSchemas } from '@adxp/lexicon'
import { recordSchemas } from '../xrpc/schemas'

export const schemas = new RecordSchemas()

for (const schema of recordSchemas) {
  schemas.add(schema)
}

export default schemas
