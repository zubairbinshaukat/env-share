import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
  )
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "end",
  onClick,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  // Radix renders the menu via a Portal, but React's synthetic events still
  // bubble up the React tree. Stopping propagation here prevents card-level
  // onClick/onKeyDown handlers from firing when the user activates a menu item.
  return (
    <DropdownMenuPortal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        onClick={(event) => {
          event.stopPropagation()
          onClick?.(event)
        }}
        onKeyDown={(event) => {
          event.stopPropagation()
          onKeyDown?.(event)
        }}
        className={cn(
          "z-50 min-w-44 overflow-hidden rounded-lg border border-border bg-popover p-1 text-foreground shadow-[var(--shadow-card-hover)] outline-none",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </DropdownMenuPortal>
  )
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-foreground outline-none transition-colors duration-150",
        "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "data-[variant=destructive]:text-destructive",
        "data-[variant=destructive]:data-[highlighted]:bg-destructive/10 data-[variant=destructive]:data-[highlighted]:text-destructive",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        "data-[highlighted]:[&_svg]:text-foreground",
        "data-[variant=destructive]:[&_svg]:text-destructive",
        "data-[variant=destructive]:data-[highlighted]:[&_svg]:text-destructive",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
