"use client"

import { useMemo, useState, type ReactNode } from "react"
import { FunnelIcon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useQueryState } from "@/hooks/use-query-state"
import { colorForKey } from "@/lib/aa/colors"
import {
  PURPOSE_OPTIONS,
  activeFilterCount,
  hasActiveFilters,
  parseCatalogFilters,
  providersInCatalog,
  serializeCatalogFilters,
  type CatalogFilters,
  type OpenFilter,
  type PurposeKey,
} from "@/lib/aa/filter"
import type { ModelNode } from "@/lib/aa/types"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

export function FilterBar({
  catalog,
  filteredCount,
}: {
  catalog: ModelNode[]
  filteredCount: number
}) {
  const { get, set } = useQueryState()
  const { t } = useI18n()
  const [providerQuery, setProviderQuery] = useState("")

  const filters = useMemo(() => parseCatalogFilters(get), [get])
  const facets = useMemo(() => providersInCatalog(catalog), [catalog])
  const activeCount = activeFilterCount(filters)
  const active = hasActiveFilters(filters)

  const providerNameBySlug = useMemo(() => {
    const map = new Map<string, string>()
    for (const facet of facets) map.set(facet.provider.slug, facet.provider.name)
    return map
  }, [facets])

  function commit(next: CatalogFilters) {
    set(serializeCatalogFilters(next))
  }

  function toggleOpen(value: Exclude<OpenFilter, "all">) {
    commit({ ...filters, open: filters.open === value ? "all" : value })
  }

  function togglePurpose(key: PurposeKey) {
    const purposes = filters.purposes.includes(key)
      ? filters.purposes.filter((item) => item !== key)
      : [...filters.purposes, key]
    commit({ ...filters, purposes })
  }

  function toggleProvider(slug: string) {
    const providers = filters.providers.includes(slug)
      ? filters.providers.filter((item) => item !== slug)
      : [...filters.providers, slug]
    commit({ ...filters, providers })
  }

  function clear() {
    commit({ providers: [], open: "all", purposes: [] })
  }

  const visibleFacets = facets.filter((facet) => {
    if (!providerQuery.trim()) return true
    const q = providerQuery.trim().toLowerCase()
    return (
      facet.provider.name.toLowerCase().includes(q) || facet.provider.slug.toLowerCase().includes(q)
    )
  })

  const remaining = t("filter.modelsRemaining", { count: filteredCount, total: catalog.length })
  const chipProps = {
    filters,
    toggleOpen,
    togglePurpose,
    providerQuery,
    onProviderQuery: setProviderQuery,
    visibleFacets,
    toggleProvider,
  }

  return (
    <>
      <div className="flex items-center gap-2 sm:hidden">
        <Dialog>
          <DialogTrigger
            render={
              <Button variant={active ? "default" : "outline"} size="sm" className="gap-1.5">
                <FunnelIcon className="size-3.5" />
                {t("filter.label")}
                {activeCount > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 font-mono text-[10px]">
                    {activeCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <DialogContent className="max-h-[min(85vh,36rem)] gap-3 overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("filter.label")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChips {...chipProps} />
            </div>
            <SelectedProviders
              slugs={filters.providers}
              names={providerNameBySlug}
              onRemove={toggleProvider}
            />
            <p className="text-xs text-muted-foreground">{remaining}</p>
            <DialogFooter className="sm:justify-between">
              {active ? (
                <Button variant="outline" size="sm" onClick={clear}>
                  {t("filter.clear")}
                </Button>
              ) : (
                <span />
              )}
              <DialogClose render={<Button size="sm" />}>{t("filter.done")}</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{remaining}</span>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="shrink-0 text-muted-foreground"
            aria-label={t("filter.clear")}
          >
            <XIcon className="size-3.5" />
            {t("filter.clearShort")}
          </Button>
        )}
      </div>

      <div className="hidden flex-col gap-2 sm:flex">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {t("filter.label")}
            {activeCount > 0 && (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 font-mono text-[10px]">
                {activeCount}
              </Badge>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChips {...chipProps} />
            <Separator orientation="vertical" className="hidden h-4 sm:block" />
            <span className="text-xs text-muted-foreground">{remaining}</span>
            {active && (
              <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
                {t("filter.clear")}
                {activeCount > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 font-mono text-[10px]">
                    {activeCount}
                  </Badge>
                )}
              </Button>
            )}
          </div>
        </div>
        <SelectedProviders
          slugs={filters.providers}
          names={providerNameBySlug}
          onRemove={toggleProvider}
        />
      </div>
    </>
  )
}

function SelectedProviders({
  slugs,
  names,
  onRemove,
}: {
  slugs: string[]
  names: Map<string, string>
  onRemove: (slug: string) => void
}) {
  const { t } = useI18n()
  if (slugs.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {slugs.map((slug) => (
        <Badge key={slug} variant="secondary" className="h-6 gap-1 pr-1">
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: colorForKey(slug) }}
            aria-hidden="true"
          />
          {names.get(slug) ?? slug}
          <button
            type="button"
            onClick={() => onRemove(slug)}
            className="rounded-full p-0.5 hover:bg-muted"
            aria-label={t("filter.removeProvider", { name: names.get(slug) ?? slug })}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

function FilterChips({
  filters,
  toggleOpen,
  togglePurpose,
  providerQuery,
  onProviderQuery,
  visibleFacets,
  toggleProvider,
}: {
  filters: CatalogFilters
  toggleOpen: (value: Exclude<OpenFilter, "all">) => void
  togglePurpose: (key: PurposeKey) => void
  providerQuery: string
  onProviderQuery: (value: string) => void
  visibleFacets: ReturnType<typeof providersInCatalog>
  toggleProvider: (slug: string) => void
}) {
  const { t } = useI18n()

  return (
    <>
      <Chip pressed={filters.open === "open"} onClick={() => toggleOpen("open")}>
        {t("filter.open")}
      </Chip>
      <Chip pressed={filters.open === "proprietary"} onClick={() => toggleOpen("proprietary")}>
        {t("filter.proprietary")}
      </Chip>
      {PURPOSE_OPTIONS.map((opt) => (
        <Chip
          key={opt.key}
          pressed={filters.purposes.includes(opt.key)}
          onClick={() => togglePurpose(opt.key)}
        >
          {t(opt.labelKey)}
        </Chip>
      ))}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1.5">
              <FunnelIcon className="size-3.5 text-muted-foreground" />
              {t("filter.provider")}
              {filters.providers.length > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 font-mono text-[10px]">
                  {filters.providers.length}
                </Badge>
              )}
            </Button>
          }
        />
        <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-2">
          <div className="flex flex-col gap-2">
            <Input
              value={providerQuery}
              onChange={(event) => onProviderQuery(event.target.value)}
              placeholder={t("filter.providerSearch")}
              aria-label={t("filter.providerSearch")}
              className="h-7 text-sm"
            />
            <ScrollArea className="h-56">
              {visibleFacets.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  {t("filter.providerNone")}
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5 pr-2">
                  {visibleFacets.map(({ provider, count }) => {
                    const selected = filters.providers.includes(provider.slug)
                    return (
                      <li key={provider.slug}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleProvider(provider.slug)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            selected
                              ? "bg-primary/15 text-foreground"
                              : "text-foreground/85 hover:bg-accent",
                          )}
                        >
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: colorForKey(provider.slug) }}
                            aria-hidden="true"
                          />
                          <span className="flex-1 truncate">{provider.name}</span>
                          <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                            {count}
                          </Badge>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "default" : "outline"}
      size="sm"
      aria-pressed={pressed}
      onClick={onClick}
      className={pressed ? undefined : "text-foreground/85"}
    >
      {children}
    </Button>
  )
}
