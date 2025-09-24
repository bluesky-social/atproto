import { Stack } from 'expo-router'
import { PdsAgentProvider } from '@/components/PdsAgentProvider'

export default function AuthenticatedLayout() {
  return (
    <PdsAgentProvider>
      <Stack />
    </PdsAgentProvider>
  )
}
