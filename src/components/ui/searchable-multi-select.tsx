'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

type Option = {
  value: string
  label: string
}

type SearchableMultiSelectProps = {
  options: Option[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  badgeClassName?: string
}

export function SearchableMultiSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  className,
  badgeClassName,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false)

  const selectedOptions = options.filter((option) => value.includes(option.value))

  const toggleOption = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter((id) => id !== optionValue)
      : [...value, optionValue]
    onValueChange(newValue)
  }

  const removeOption = (optionValue: string) => {
    onValueChange(value.filter((id) => id !== optionValue))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'h-auto min-h-11 w-full justify-start rounded-xl border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm hover:bg-white',
              className
            )}
          />
        }
      >
        <div className="flex w-full flex-wrap items-center gap-1.5">
          {selectedOptions.length === 0 ? (
            <span className="text-neutral-500">{placeholder}</span>
          ) : (
            <>
              {selectedOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className={cn(
                    'rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100',
                    badgeClassName
                  )}
                >
                  {option.label}
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-1 rounded-sm hover:bg-emerald-200 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeOption(option.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        removeOption(option.value)
                      }
                    }}
                  >
                    <X className="size-3" />
                  </span>
                </Badge>
              ))}
            </>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start" side="bottom" sideOffset={4}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggleOption(option.value)}
                  data-checked={value.includes(option.value)}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
