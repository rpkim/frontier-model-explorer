import { DatabaseIcon } from "lucide-react"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { SyncButton } from "@/components/explorer/sync-button"

export function SyncEmptyState() {
  return (
    <Empty className="min-h-[60vh] border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DatabaseIcon />
        </EmptyMedia>
        <EmptyTitle>아직 동기화된 데이터가 없습니다</EmptyTitle>
        <EmptyDescription>
          Artificial Analysis Data API에서 프론티어 모델 데이터를 가져오려면 동기화를 실행하세요.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <SyncButton variant="default" />
      </EmptyContent>
    </Empty>
  )
}
