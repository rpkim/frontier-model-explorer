"use client"

import { ScaleIcon, ServerCogIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQueryState } from "@/hooks/use-query-state"
import { useI18n } from "@/lib/i18n/provider"

const MAX_COMPARE_MODELS = 4

export function ModelActions({
  modelId,
  openWeight = false,
}: {
  modelId: string
  openWeight?: boolean
}) {
  const { t } = useI18n()
  const { get, set } = useQueryState()

  function compare() {
    const raw = get("models")
    const ids = raw ? raw.split(",").filter(Boolean) : []
    const nextIds = ids.includes(modelId)
      ? ids
      : ids.length < MAX_COMPARE_MODELS
        ? [...ids, modelId]
        : [modelId]
    set({ tab: "compare", models: nextIds.join(",") })
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Button type="button" variant="ghost" size="xs" onClick={compare}>
        <ScaleIcon data-icon="inline-start" />
        {t("actions.compare")}
      </Button>
      {openWeight && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => set({ tab: "guides", guideModel: modelId })}
        >
          <ServerCogIcon data-icon="inline-start" />
          {t("actions.guide")}
        </Button>
      )}
    </span>
  )
}
