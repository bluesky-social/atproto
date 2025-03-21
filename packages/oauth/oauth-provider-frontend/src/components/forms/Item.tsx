import React from 'react'

export function Item({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>
}
