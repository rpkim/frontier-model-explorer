"use client"

import { useState } from "react"
import { CpuIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PasswordDialog } from "@/components/explorer/password-dialog"
import { useQueryState } from "@/hooks/use-query-state"
import type { ModelGuide } from "@/lib/aa/types"
import { useI18n } from "@/lib/i18n/provider"

function errorMessage(
  error: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
): string {
  switch (error) {
    case "LLM_KEY_MISSING":
      return t("guide.errorMissingKey", { env: "GOOGLE_GENERATIVE_AI_API_KEY" })
    case "NO_SNAPSHOT":
      return t("guide.errorNoSnapshot")
    case "NOT_OPEN":
      return t("guide.errorNotOpen")
    case "HUB_DETAIL_MISSING":
      return t("guide.errorHubMissing")
    case "MODEL_NOT_FOUND":
      return t("hub.modelNotFound")
    case "INVALID_SYNC_PASSWORD":
      return t("sync.invalidPassword")
    case "SYNC_PASSWORD_NOT_CONFIGURED":
      return t("sync.passwordNotConfigured")
    default:
      return t("guide.errorGeneric")
  }
}

export function ComputeGuideButton({
  modelId,
  disabled = false,
  size = "xs",
  openGuidesTab = true,
}: {
  modelId: string
  disabled?: boolean
  size?: "xs" | "sm"
  openGuidesTab?: boolean
}) {
  const { t, locale } = useI18n()
  const { set } = useQueryState()
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function generate(password: string) {
    setGenerating(true)
    try {
      const response = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, modelId, locale }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string; guide?: ModelGuide }
      if (!response.ok || !body.ok || !body.guide) {
        toast.error(errorMessage(body.error, t))
        return
      }
      toast.success(t("hub.computeSuccess"))
      if (openGuidesTab) set({ tab: "guides", guideModel: modelId })
    } catch {
      toast.error(t("guide.errorGeneric"))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={disabled || generating}
        title={disabled ? t("hub.computeDisabled") : undefined}
        onClick={() => setOpen(true)}
      >
        {generating ? (
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
        ) : (
          <CpuIcon data-icon="inline-start" />
        )}
        {generating ? t("hub.computingResources") : t("hub.computeResources")}
      </Button>
      <PasswordDialog
        open={open}
        onOpenChange={setOpen}
        pending={generating}
        onSubmit={(password) => void generate(password)}
        title={t("hub.computePasswordTitle")}
        description={t("hub.computePasswordDescription")}
      />
    </>
  )
}
