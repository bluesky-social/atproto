import { useGetTokenInfoQuery } from '../queries/use-get-token-info-query.ts'
import { Button } from './Button.tsx'
import { JsonQueryResult } from './JsonQueryResult.tsx'

export function TokenInfo() {
  const result = useGetTokenInfoQuery()

  return (
    <div>
      <h2>
        Token info
        <Button
          action={async () => result.refetch({ throwOnError: false })}
          className="ml-1"
          size="small"
          transparent
        >
          refresh
        </Button>
      </h2>
      <JsonQueryResult result={result} />
    </div>
  )
}
