import { Suspense } from "react"
import { ExplorerHeader } from "@/components/explorer/header"
import { ExplorerTabs } from "@/components/explorer/explorer-tabs"
import { SyncEmptyState } from "@/components/explorer/sync-empty-state"
import { getLatestSnapshot } from "@/app/actions/sync"

export default async function Page() {
  const snapshot = await getLatestSnapshot()

  return (
    <main className="flex h-dvh flex-col">
      <ExplorerHeader syncedAt={snapshot?.syncedAt ?? null} modelCount={snapshot?.models.length ?? 0} />
      {snapshot && snapshot.models.length > 0 ? (
        <Suspense>
          <ExplorerTabs models={snapshot.models} />
        </Suspense>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4">
          <SyncEmptyState />
        </div>
      )}
    </main>
  )
}
