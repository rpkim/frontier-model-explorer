"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ServerIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PasswordDialog } from "@/components/explorer/password-dialog"
import { useI18n } from "@/lib/i18n/provider"

type HubButtonVariant = "outline" | "default"

export function HubRefreshButton({
  variant = "outline",
  modelId,
  label,
  size = "sm",
}: {
  variant?: HubButtonVariant
  modelId?: string
  label?: string
  size?: "sm" | "xs"
}) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { t } = useI18n()

  const handleSubmit = (password: string) => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/hub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, modelId }),
        })
        const result = (await response.json()) as {
          ok?: boolean
          error?: string
          stats?: { updated: number; unmapped: number; failed: number }
        }

        if (result.ok) {
          toast.success(modelId ? t("hub.successOne") : t("hub.success"), {
            description: result.stats
              ? t("hub.successDescription", {
                  updated: result.stats.updated,
                  unmapped: result.stats.unmapped,
                  failed: result.stats.failed,
                })
              : undefined,
          })
          router.refresh()
          return
        }

        const description =
          result.error === "UNKNOWN_HUB_ERROR"
            ? t("hub.unknownError")
            : result.error === "INVALID_SYNC_PASSWORD"
              ? t("sync.invalidPassword")
              : result.error === "SYNC_PASSWORD_NOT_CONFIGURED"
                ? t("sync.passwordNotConfigured")
                : result.error === "NO_SNAPSHOT"
                  ? t("hub.noSnapshot")
                  : result.error === "NOT_OPEN"
                    ? t("hub.notOpen")
                    : result.error === "MODEL_NOT_FOUND"
                      ? t("hub.modelNotFound")
                      : result.error
        toast.error(t("hub.failed"), { description })
      } catch {
        toast.error(t("hub.failed"), { description: t("hub.unknownError") })
      }
    })
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} disabled={isPending}>
        <ServerIcon data-icon="inline-start" className={isPending ? "animate-pulse" : ""} />
        {isPending ? t("hub.inProgress") : (label ?? (modelId ? t("hub.refreshThis") : t("hub.now")))}
      </Button>
      <PasswordDialog
        open={open}
        onOpenChange={setOpen}
        pending={isPending}
        onSubmit={handleSubmit}
        title={t("hub.passwordTitle")}
        description={t("hub.passwordDescription")}
      />
    </>
  )
}
