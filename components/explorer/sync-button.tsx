"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PasswordDialog } from "@/components/explorer/password-dialog"
import { syncModels } from "@/app/actions/sync"
import { useI18n } from "@/lib/i18n/provider"

export function SyncButton({ variant = "outline" }: { variant?: "outline" | "default" }) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { t } = useI18n()

  const handleSubmit = (password: string) => {
    startTransition(async () => {
      const result = await syncModels(password)
      if (result.ok) {
        toast.success(t("sync.success"), {
          description: result.snapshot
            ? t("sync.successDescription", { count: result.snapshot.models.length })
            : undefined,
        })
        router.refresh()
      } else {
        const description =
          result.error === "INVALID_SYNC_PASSWORD"
            ? t("sync.invalidPassword")
            : result.error === "SYNC_PASSWORD_NOT_CONFIGURED"
              ? t("sync.passwordNotConfigured")
              : result.error === "AA_API_NOT_CONFIGURED"
                ? t("sync.apiNotConfigured")
                : result.error?.startsWith("AA_API_") || result.error === "SYNC_FAILED"
                  ? t("sync.unknownError")
                  : result.error ?? t("sync.unknownError")
        toast.error(t("sync.failed"), { description })
      }
    })
  }

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} disabled={isPending}>
        <RefreshCwIcon data-icon="inline-start" className={isPending ? "animate-spin" : ""} />
        {isPending ? t("sync.inProgress") : t("sync.now")}
      </Button>
      <PasswordDialog open={open} onOpenChange={setOpen} pending={isPending} onSubmit={handleSubmit} />
    </>
  )
}
