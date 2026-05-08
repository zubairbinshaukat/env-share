---
name: Design overhaul to sleek
overview: "Apply a Linear/Vercel/Stripe-inspired design system across EnvShare: rewrite tokens (color, type, radii, shadows), refine UI primitives, and rebuild the dashboard, project view, and shared view to the new visual specification."
todos:
  - id: tokens
    content: Rewrite color/type/radius/shadow tokens in src/index.css to match the brief (emerald accent, warm off-white bg, near-black dark)
    status: pending
  - id: primitives
    content: Refine button, input, card, dialog, tabs primitives to brief specs (h-9 buttons, h-10 inputs, p-6 cards, rounded-2xl dialogs, soft shadows)
    status: pending
  - id: layout
    content: Update app-shell to max-w-[1200px] + warm bg, refine top-nav to h-16 with scroll-aware backdrop blur
    status: pending
  - id: project-card
    content: "Rebuild project card: name 16/600, env-count + timeAgo line, monospace share-code pill, accent border + soft shadow on hover"
    status: pending
  - id: env-count-server
    content: Add environmentCount to ProjectMeta server-side (api/projects/* + types + api client + store)
    status: pending
  - id: dashboard
    content: "Apply new dashboard layout: clean header, grid of refined cards, brief-spec empty state, soft skeletons"
    status: pending
  - id: project-view
    content: "Restyle project view: back ghost link, 32px title, monospace share pill, refined env actions and tabs"
    status: pending
  - id: shared-view
    content: "Restyle shared view: matching header, each env wrapped in a refined card, read-only hint"
    status: pending
  - id: env-table
    content: "Rebuild env-table: borderless rows with hover bg, real CSS blur on values, eye/copy controls aligned right"
    status: pending
  - id: new-project-dialog
    content: Apply dialog spec to new-project-dialog and migration-prompt; refine folder picker idle state to brief empty-state pattern
    status: pending
  - id: landing
    content: "Refine landing: 48px hero, refined feature cards, share-code form with proper label"
    status: pending
  - id: cleanup
    content: Remove bg-app-grid, drop redundant motion wrappers, swap toaster to top-right, strip any leftover emoji/blue/indigo
    status: pending
isProject: false
---


## Decisions

- **Accent**: emerald `#10B981` (continues current brand; swap to violet by changing one CSS variable later).
- **Env count on cards**: surface via a tiny server addition (`environmentCount` on `ProjectMeta`) so the brief's `"{n} environments · {timeAgo}"` line is real, not faked.
- **No new dependencies**: Inter, JetBrains Mono, framer-motion, sonner, next-themes, Tailwind v4 are already wired.

## 1. Design tokens — [src/index.css](src/index.css)

Replace the OKLCH values in `:root` and `.dark` with the brief's hex palette (kept as `oklch(from #hex)` won't work in Tailwind v4 — use direct `oklch()` conversions or hex literals). Concretely:

- Light: `--background: #FAFAF9`, `--card/--popover: #FFFFFF`, `--border/--input: #E7E5E4`, `--foreground: #1C1917`, `--muted-foreground: #57534E`, plus a new `--text-muted: #A8A29E`.
- Dark: `--background: #0A0A0A`, `--card/--popover: #141414`, `--border/--input: #262626`, `--foreground: #FAFAF9`, `--muted-foreground: #A8A29E`, `--text-muted: #57534E`.
- Both: `--primary: #10B981`, `--primary-foreground: #FFFFFF`, `--ring: #10B981`, `--destructive: #EF4444`.
- `--radius: 0.75rem` (12px cards). Add `--radius-button: 0.5rem` (8px) and `--radius-input: 0.375rem` (6px) usage rules in components.
- Drop the `--accent` light-tinted background (currently emerald-tinted) — make `--accent` a neutral subtle bg (`--muted` aliased), since the brief uses "accent" only for the primary action color.
- Replace the `bg-app-grid` utility with a soft warm off-white background (no grid). Optionally keep grid behind hero only, but per "no gradients/no busy backgrounds" preference, default to clean.
- Add a global shadow scale: `--shadow-card-hover: 0 4px 16px -4px rgba(0,0,0,0.08)`, `--shadow-modal: 0 24px 48px -12px rgba(0,0,0,0.18)`.

## 2. Layout — container & nav

- [src/components/layout/app-shell.tsx](src/components/layout/app-shell.tsx): bump container from `max-w-5xl` to `max-w-[1200px]`, change main background to `bg-background` (warm off-white), increase vertical rhythm to `pt-12 pb-24`, move `Toaster` to `position="top-right"`.
- [src/components/layout/top-nav.tsx](src/components/layout/top-nav.tsx): height `h-16`, `border-b` 1px subtle, `backdrop-blur` only when scrolled (track scrollY with a small hook), logo weight 600 / 16px, nav items become 13–14px. Drop the "Design" link from production header (or hide behind dev-only flag) so the navbar matches the brief's "Logo left + theme toggle + user button" exactly.

## 3. UI primitives

- [src/components/ui/button.tsx](src/components/ui/button.tsx): default `h-9` `rounded-lg` `px-4` `font-medium`; `outline` = transparent bg + border + hover muted; `ghost` = no border + hover muted; add `active:scale-[0.98]`; transitions `duration-150`. Resize `icon` to `size-9`, `icon-sm` to `size-8`. Drop the emerald-tinted aria-expanded states.
- [src/components/ui/input.tsx](src/components/ui/input.tsx): `h-10 rounded-lg px-3 text-sm`, focus border = accent, focus ring = `ring-2 ring-primary/20`. Placeholder uses `text-muted-foreground`.
- [src/components/ui/card.tsx](src/components/ui/card.tsx): replace `ring-1 ring-foreground/10` with `border border-border`, default `p-6` (remove gap-4 + py-4 + per-slot px-4), `rounded-xl`. Hover treatment is opt-in (project card adds it). Remove the muted footer bar background.
- [src/components/ui/dialog.tsx](src/components/ui/dialog.tsx): `rounded-2xl p-6 max-w-md` default, `max-w-2xl` opt-in for folder import. Overlay → `bg-black/40 backdrop-blur-sm`. Add framer-motion-friendly scale+fade (Radix `data-open` already gives this; tighten to 200ms). Replace ring with shadow `--shadow-modal`. Drop the muted footer slot.
- [src/components/ui/tabs.tsx](src/components/ui/tabs.tsx): keep behavior; tweak active state to remove `shadow-sm` and use a subtle `border` instead.
- [src/components/ui/sonner.tsx](src/components/ui/sonner.tsx): no structural change — just confirm tokens map cleanly.

## 4. Project card — [src/components/projects/project-card.tsx](src/components/projects/project-card.tsx)

Rebuild to match the brief exactly:

```tsx
<Card className="cursor-pointer p-6 transition-all duration-150 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]">
  <h3 className="text-base font-semibold tracking-[-0.01em]">{project.name}</h3>
  <p className="mt-1.5 text-[13px] text-muted-foreground">
    {envCount} {envCount === 1 ? "environment" : "environments"} · {timeAgo(project.updatedAt)}
  </p>
  <div className="mt-4 flex items-center justify-between">
    <code className="rounded-full bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
      {project.shareCode}
    </code>
    <Button variant="ghost" size="icon-sm" onClick={handleCopy}>...</Button>
  </div>
</Card>
```

Add a `timeAgo()` helper in [src/lib/utils.ts](src/lib/utils.ts) (now / Xm / Xh / Xd / Xw / formatted date).

## 5. Pages

- **Dashboard** [src/pages/dashboard.tsx](src/pages/dashboard.tsx): drop the `text-xs uppercase` eyebrow; header is a single 32px / weight 600 / -0.02em "Projects" with right-aligned primary "New project" button. Grid stays 1/2/3 cols. Empty state becomes the full brief spec: `py-24` centered, 64×64 circle (icon `PackageOpen`) on warm muted bg, 18px/600 heading, 14px muted subtext capped to `max-w-sm`, single primary CTA + secondary "Create manually" ghost. Loading: replace `animate-pulse` with subtle bg-muted skeletons (no gradient shimmer).
- **Project view** [src/pages/project-view.tsx](src/pages/project-view.tsx): back link as ghost button + `ArrowLeft`, project name 32px/600, share code as monospace pill (matches card), copy-link primary button. `EnvActions` row: variable count left, Copy/Download as outline buttons right. Tab list uses refined tabs primitive.
- **Shared view** [src/pages/shared-view.tsx](src/pages/shared-view.tsx): same header treatment as project view minus owner actions; each environment is a `Card` (p-6) wrapping `EnvTable`. Add a small "Read-only · decrypted in your browser" hint under the title.
- **Landing** [src/components/auth/landing.tsx](src/components/auth/landing.tsx): tighten — heading 48px/600/-0.02em, body text-secondary, primary CTA `size="lg"`, three feature cards switch to bordered surface (no `bg-card/70`), share code form gains `Label` 13px/500.

## 6. Env value table — [src/components/projects/env-table.tsx](src/components/projects/env-table.tsx)

Drop the heavy outer border + header bar. Replace with:

```tsx
<ul className="divide-y divide-border">
  {variables.map((v) => (
    <li className="grid grid-cols-[200px_1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/60">
      <code className="font-mono text-[13px] font-medium">{v.key}</code>
      <code className={cn("font-mono text-[13px]", visible ? "text-foreground" : "blur-sm select-none")}>{v.value}</code>
      <div className="flex gap-0.5">{/* eye + copy */}</div>
    </li>
  ))}
</ul>
```

Use real CSS `blur` instead of bullet-mask so toggling feels softer.

## 7. New project dialog — [src/components/projects/new-project-dialog.tsx](src/components/projects/new-project-dialog.tsx)

- Apply `max-w-2xl` opt-in. Folder picker idle state: 64×64 muted circle with `FolderOpen`, 18/600 heading, 14 muted subtext, primary CTA — matches the empty-state pattern.
- Manual draft cards: `rounded-xl border border-border p-4` (remove the `border-border/70` softening), filename input gets the new mono treatment.

## 8. Server — env count

Add `environmentCount: number` to records and responses:

- [api/projects/index.ts](api/projects/index.ts): accept and persist `environmentCount` on POST; include it in GET projection.
- `api/projects/[shareCode].ts` (mirror file — apply same change).
- [src/lib/types.ts](src/lib/types.ts): extend `ProjectMeta` with `environmentCount: number`.
- [src/store/projects-store.ts](src/store/projects-store.ts) and [src/lib/api.ts](src/lib/api.ts): pass `environmentCount: input.environments.length` on create/update.

## 9. Misc cleanup

- Remove the `bg-app-grid` utility usage (warm bg only). Strip emoji from any UI copy. Remove the indigo/blue fallbacks (none currently in use after token rewrite). Remove `motion.div` wrappers that wrap non-animated content; keep one fade-in (200ms) per route.
- [src/components/migration-prompt.tsx](src/components/migration-prompt.tsx): adopt new dialog spec (no copy changes).
- [src/components/theme-toggle.tsx](src/components/theme-toggle.tsx): keep API; visual updates inherit from button refresh.

## Out of scope

- No new routes, no auth/data flow changes beyond `environmentCount`.
- Design system page ([src/pages/design-system.tsx](src/pages/design-system.tsx)) stays functional but is not the focus; it'll inherit the new tokens automatically.
