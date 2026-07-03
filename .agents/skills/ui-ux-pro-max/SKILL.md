---
name: ui-ux-pro-max
description: Professional UI/UX design rules and golden-theme design system for الفارس الذهبي للدعاية project. Use whenever building or refining UI components, pages, popups, cards, or map markers — covers color palette, typography, motion, anti-patterns, RTL Arabic interface rules, and a pre-delivery quality checklist distilled from UI/UX Pro Max and Open Design.
---

# UI/UX Pro Max — Golden Knight Design System

Distilled from the [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) and [Open Design](https://github.com/nexu-io/open-design) reasoning engines, tuned to the project's golden brand identity.

## Core principles (apply to every visual change)

1. **Never use emoji or unicode characters as icons anywhere in the project (including print windows, toolbars, and PDFs).** Always use SVG (Lucide-react or inline SVG paths) which can be styled and colored using CSS/SVG properties. Characters like 📍, ✓, ✕, 🖨️, &#128438;, and &#10005; are strictly forbidden.
2. **`cursor-pointer`** on every clickable element. Hover states with `transition-all duration-200`.
3. **Contrast 4.5:1 minimum** for body text against background, 3:1 for large text.
4. **No generic AI aesthetics:** no purple-to-pink gradients, no Inter/Poppins default pairings, no white card on white background.
5. **Use the project's semantic tokens** (`bg-primary`, `text-foreground`, `border-border` …) — never hardcode hex inside components except inside SVG generators (maps, pins, PDFs).
6. **Status badges** use `bg-primary/10 text-primary` for high contrast on both light and dark themes.
7. **Respect `prefers-reduced-motion`** — wrap optional animations in `motion-safe:` Tailwind variants.
8. **Responsive checkpoints:** 375 / 768 / 1024 / 1440 px.

## RTL & Arabic Interface Rules (MANDATORY)

This project is a **fully Arabic RTL application**. Every component, page, layout, and interactive element must respect RTL conventions:

### Layout & Direction
- Every container that holds Arabic content must have `dir="rtl"` on the root element of the page or the component.
- **Never** set `dir="ltr"` on Arabic text elements — only on isolated elements containing Latin-only content (e.g., monospace code blocks or number-only labels).
- Flex rows for Arabic UI should flow right-to-left by default. Use `flex-row-reverse` only if the base flex direction is already overridden.
- Padding, borders, and margins follow RTL semantics: `border-r-*` is the **primary accent border** (visually on the right = start in RTL).

### Navigation & Breadcrumbs
- Breadcrumb separators in Arabic UIs use **`ChevronRight`** (pointing left visually in RTL = next level), **not** `ChevronLeft`.
- Back buttons that go to a previous screen use **`ArrowRight`** icon (pointing rightward = "back" in Arabic reading direction).
- Tab bars scroll horizontally right-to-left. Active tab indicator is `border-b-2 border-primary`.
- Do **not** flip or `rotate` chevrons manually — use the correct semantic icon for the RTL context:
  - **Breadcrumb separator**: `ChevronRight` (renders as ← visually in RTL)
  - **Back navigation**: `ArrowRight`
  - **Dropdown open indicator**: `ChevronDown`
  - **Expand/collapse row**: `ChevronDown` / `ChevronUp`

### Icons & Buttons
- Icon-and-text buttons: icon comes **after** the label text in RTL (`<span>نص</span><Icon />`), or use `gap-*` and let RTL ordering handle it naturally via flex.
- For `ml-*` / `mr-*` spacing between icon and text: prefer `gap-*` on the flex container instead of directional margins.

### Typography in print / PDF
- Always embed `font-family: 'Tajawal', 'Manrope', sans-serif` in generated print HTML.
- Print windows must have `<html dir="rtl" lang="ar">`.

### Form Inputs
- Text inputs: `text-align: right` is the default for Arabic inputs.
- Search icons go on the **right** side of the input (`right-3` in Tailwind), and `pr-9` padding for the input value.

## Brand palette

- **Primary Gold:** `#d6ac40` (HSL `42 67% 55%`)
- **Gold Highlight:** `#f4c25a`
- **Gold Deep:** `#b8860b`
- **Dark Surface:** `#0a0a14` → `#15110a` (radial)
- **Light Surface:** HSL `40 20% 98%`
- **Status colors:** متاح `#22C55E` · مؤجر `#2D6BFF` · قريباً `#F59E0B` · صيانة `#EF4444` · مخفي `#94A3B8`

## Typography

- Arabic body / UI: **Tajawal**
- Latin display / numbers in pins/badges: **Manrope** (already loaded)
- Never fall back to system fonts inside generated SVG — embed `font-family="'Manrope', 'Tajawal', sans-serif"`.

## Motion register

- Hover / press: 150–200 ms ease-out
- Card enter: 250–300 ms (use `animate-in fade-in slide-in-from-*`)
- Pulse / glow on selection: 2 s loop, opacity 0.7 → 1
- Avoid simultaneous large-area animations that fight for attention.

## Unified Print System

All pages that need printing **must** use the shared `openPrintWindow` utility from `@/lib/printStyles`:
```ts
import { openPrintWindow } from "@/lib/printStyles";
import { useQuery } from "@tanstack/react-query";
// Fetch company settings first, then pass to openPrintWindow
openPrintWindow(title, htmlContent, settings);
```
- Never use `window.print()` directly on the React page — always generate a separate print window.
- Build the `htmlContent` string using table-based HTML for tabular data.
- The print button in the UI must use `<Printer className="h-4 w-4" />` from lucide-react.

## Reference files

- `references/design-systems.md` — when to pick which visual style
- `references/anti-patterns.md` — patterns to never ship
- `references/checklist.md` — pre-delivery QA
- `references/map-pins.md` — specific rules for map pin SVGs

## Anti-patterns (never ship)

- Emoji icons inside cards, buttons, popups.
- Pop-ups floating far from their anchor (more than 8 px gap between InfoWindow tip and marker top).
- Pins that look like rounded rectangles with stubby tails — use real teardrop or pill+pointer shapes.
- Dark text on dark gradients without a scrim.
- Buttons without hover state or without `cursor-pointer`.
- Using `ChevronLeft` as a breadcrumb separator in RTL layouts — use `ChevronRight`.
- Using `ArrowLeft` as a "back" button in RTL layouts — use `ArrowRight`.
- Hardcoding `dir="ltr"` on Arabic content containers.