import { BrainCircuitIcon } from "lucide-react"
import { SyncButton } from "@/components/explorer/sync-button"
import { timeAgo } from "@/lib/aa/format"

export function ExplorerHeader({ syncedAt, modelCount }: { syncedAt: string | null; modelCount: number }) {
  return (
    <header className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <BrainCircuitIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-balance text-lg font-semibold leading-tight tracking-tight">Frontier Model Explorer</h1>
          <p className="text-xs text-muted-foreground">
            {modelCount > 0 ? (
              <>
                <span className="font-mono tabular-nums">{modelCount}</span>개 모델 · Artificial Analysis 데이터
              </>
            ) : (
              "Artificial Analysis 데이터"
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {syncedAt && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            마지막 동기화 <span className="font-mono">{timeAgo(syncedAt)}</span>
          </span>
        )}
        <SyncButton />
      </div>
    </header>
  )
}
