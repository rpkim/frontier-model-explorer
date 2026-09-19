import { Suspense } from "react"
import { ExplorerHeader } from "@/components/explorer/header"
import { ExplorerTabs } from "@/components/explorer/explorer-tabs"
import { SyncEmptyState } from "@/components/explorer/sync-empty-state"
import { AgentWidget } from "@/components/agent/agent-widget"
import { getLatestHubSnapshot } from "@/app/actions/hub"
import { getLatestSnapshot } from "@/app/actions/sync"
import { isAgentEnabled, isGeminiConfigured } from "@/lib/aa/env"

export const maxDuration = 300

export default async function Page() {
  const [snapshot, hub] = await Promise.all([getLatestSnapshot(), getLatestHubSnapshot()])
  const hasSnapshot = Boolean(snapshot && snapshot.models.length > 0)
  const showAgent = isAgentEnabled() && isGeminiConfigured()

  return (
    <main className="flex h-dvh flex-col">
      <ExplorerHeader
        syncedAt={snapshot?.syncedAt ?? null}
        hubFetchedAt={hub?.fetchedAt ?? null}
        modelCount={snapshot?.models.length ?? 0}
      />
      {snapshot && snapshot.models.length > 0 ? (
        <Suspense>
          <ExplorerTabs models={snapshot.models} syncedAt={snapshot.syncedAt} hub={hub} />
        </Suspense>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4">
          <SyncEmptyState />
        </div>
      )}
      {showAgent ? <AgentWidget hasSnapshot={hasSnapshot} /> : null}
    </main>
  )
}
