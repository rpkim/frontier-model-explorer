"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { syncModels } from "@/app/actions/sync"

export function SyncButton({ variant = "outline" }: { variant?: "outline" | "default" }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSync = () => {
    startTransition(async () => {
      const result = await syncModels()
      if (result.ok) {
        toast.success("최신 데이터로 동기화했습니다.", {
          description: result.snapshot ? `${result.snapshot.models.length}개 모델을 불러왔습니다.` : undefined,
        })
        router.refresh()
      } else {
        toast.error("동기화에 실패했습니다.", { description: result.error })
      }
    })
  }

  return (
    <Button variant={variant} size="sm" onClick={handleSync} disabled={isPending}>
      <RefreshCwIcon data-icon="inline-start" className={isPending ? "animate-spin" : ""} />
      {isPending ? "동기화 중..." : "지금 동기화"}
    </Button>
  )
}
