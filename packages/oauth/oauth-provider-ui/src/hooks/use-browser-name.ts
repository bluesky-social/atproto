import { useMemo } from 'react'
import { UAParser } from 'ua-parser-js'

export function useBrowserName(userAgent?: string): string | undefined {
  const ua = useMemo(
    () => (userAgent ? UAParser(userAgent) : null),
    [userAgent],
  )

  return ua
    ? ua.device.is('mobile')
      ? [ua.os.name].filter(Boolean).join(' • ')
      : [ua.os.name, ua.browser.name].filter(Boolean).join(' • ')
    : undefined
}
