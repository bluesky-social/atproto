import { PdsAgentProvider } from '@/components/PdsAgentProvider'
import { Stack } from 'expo-router'

export default function AuthenticatedLayout() {
  return (
    <PdsAgentProvider>
      <Stack />
    </PdsAgentProvider>
  )
}
