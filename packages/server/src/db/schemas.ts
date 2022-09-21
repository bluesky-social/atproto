import { RecordSchemas } from '@adxp/lexicon'
import { recordSchemas } from '../lexicon/schemas'

export const schemas = new RecordSchemas()

for (const schema of recordSchemas) {
  schemas.add(schema)
}

export default schemas
