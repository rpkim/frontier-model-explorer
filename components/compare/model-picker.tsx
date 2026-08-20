"use client"

import { useState } from "react"
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { colorForKey } from "@/lib/aa/colors"
import type { ModelNode } from "@/lib/aa/types"

export function ModelPicker({
  models,
  excludeIds,
  onSelect,
  disabled,
}: {
  models: ModelNode[]
  excludeIds: string[]
  onSelect: (id: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const available = models.filter((m) => !excludeIds.includes(m.id))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="w-full justify-between border-dashed sm:w-64"
            disabled={disabled}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <PlusIcon data-icon="inline-start" />
              모델 추가
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="모델 검색..." />
          <CommandList>
            <CommandEmpty>모델을 찾을 수 없습니다.</CommandEmpty>
            <CommandGroup>
              {available.map((model) => (
                <CommandItem
                  key={model.id}
                  value={`${model.name} ${model.provider.name}`}
                  onSelect={() => {
                    onSelect(model.id)
                    setOpen(false)
                  }}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorForKey(model.provider.slug) }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{model.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{model.provider.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
