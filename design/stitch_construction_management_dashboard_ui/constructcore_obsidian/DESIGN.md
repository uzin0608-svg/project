---
name: ConstructCore Obsidian
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#00174b'
  on-tertiary-container: '#497cff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#003ea8'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-kpi:
    fontFamily: Inter, Pretendard, -apple-system, sans-serif
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
  headline-kpi-mobile:
    fontFamily: Inter, Pretendard, -apple-system, sans-serif
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
  headline-title:
    fontFamily: Inter, Pretendard, -apple-system, sans-serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  section-header:
    fontFamily: Inter, Pretendard, -apple-system, sans-serif
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-default:
    fontFamily: Inter, Pretendard, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-medium:
    fontFamily: Inter, Pretendard, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  body-compact:
    fontFamily: Inter, Pretendard, -apple-system, sans-serif
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-compact-bold:
    fontFamily: Inter, Pretendard, -apple-system, sans-serif
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  data-mono:
    fontFamily: JetBrains Mono, Pretendard, monospace
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  badge-label:
    fontFamily: Inter, Pretendard, -apple-system, sans-serif
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 1.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

### Identity & Purpose
This design system delivers an executive-grade operational intelligence environment for enterprise construction directors, project managers, and field supervisors. The aesthetic pairs structural engineering discipline with high-density enterprise SaaS utility. It eliminates ornamental friction in favor of relentless tabular clarity, high-contrast status feedback, and institutional reliability.

### Design Movement: Precision Architectural Minimal
- **Structure**: Rigorous 1px grid structures inspired by structural blueprints and financial terminals.
- **Surfaces**: Ultra-clean neutral canvas with deep obsidian-slate anchors for top-level navigation, driving focus into operational tables and KPI status anomalies.
- **Emotional Resonance**: Authoritative, steady, mathematically reliable, and commanding without visual fatigue during 10-hour site monitoring shifts.

## Colors

### Surface Hierarchy & Canvas Architecture
- **App Canvas Background**: `#F8FAFC` (Slate 50) delivers an eye-calming, glare-resistant workspace.
- **Card & Data Container Background**: `#FFFFFF` (Pure White).
- **Sub-tier Wells & Table Hover**: `#F1F5F9` (Slate 100) for nested cards, table headers, and inactive states.
- **Structural Dividers & Borders**: `#E2E8F0` (Slate 200) for crisp, low-glare 1px structural framing.

### Structural Brand Accents
- **Global Header / Sidebar Base**: `#0F172A` (Obsidian Navy).
- **Secondary Chrome & Elevated Modals**: `#1E293B` (Slate Navy).
- **Interactive Action Blue**: `#2563EB` (Primary buttons, link states, selected row highlights).

### Operational Performance Status Spectrum (Strict Metric Alignment)
Every status color is paired with a high-contrast ink tone and an accessible tint container:
- **Normal (정상, Variance diff ≥ 0pp)**:
  - Text & Border: `#059669` (Emerald 600)
  - Surface Fill: `#ECFDF5` (Emerald 50)
- **Warning (주의, -5pp < Variance diff < 0pp)**:
  - Text & Border: `#D97706` (Amber 600)
  - Surface Fill: `#FFFBEB` (Amber 50)
- **Inspection Needed (점검, Variance diff ≤ -5pp)**:
  - Text & Border: `#DC2626` (Rose 600)
  - Surface Fill: `#FEF2F2` (Rose 50)
- **Informational / Neutral State**:
  - Text: `#475569` (Slate 600)
  - Surface Fill: `#F1F5F9` (Slate 100)

## Typography

### Font Stack & Glyphs
- Primary font stack: `Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Pretendard covers Korean glyph sets seamlessly, matching Inter's geometric apexes and counter-spaces.
- Numeric and status metric readouts strictly enforce OpenType tabular figures: `font-feature-settings: "tnum" 1, "cv05" 1, "zero" 1`.
- Code snippets, site codes, and unit rates utilize `JetBrains Mono` for rapid scannability and column alignment.

### Executive Density Rules
- High-level dashboards enforce strict vertical hierarchy: KPI big values anchor visual landing, supported by micro badge chips.
- Table headers use uppercase micro typography (`font-size: 11px`, `letter-spacing: 0.05em`, color `#64748B`).
- Korean body copy enforces `-0.015em` letter-spacing to prevent loose whitespace gaps across enterprise terms.

## Layout & Spacing

### Layout Model
- **Workbench Architecture**: Desktop layout utilizes a fixed left navigation sidebar (`240px` expanded, `64px` collapsed) paired with an optional right-docked AI Conversational Assistant (`380px` drawer/rail).
- **Core Canvas**: 12-column fluid grid system stretching between persistent navigation rails.
- **Breakpoints**:
  - `Mobile` (< 768px): Single-column stacked cards, horizontal swipe data tables, bottom-docked navigation.
  - `Tablet` (768px – 1199px): 8-column layout, compact sidebar (`64px`), stacked dashboard widgets.
  - `Desktop` (≥ 1200px): 12-column layout, full sidebar, multi-panel data grids and side-by-side analytics.

### Spacing Philosophy
- Construction data density requires an 8px base rhythm with a 4px sub-grid for compact controls.
- Table rows use tight vertical padding (`space-xs` and `space-sm`) to maximize visible records on single viewport displays.

## Elevation & Depth

### Low-Elevation Engineering Surface Model
To support data concentration over decorative visual fluff, elevation is driven by 1px hairline boundaries (`#E2E8F0`) augmented by whisper-thin ambient shadows.

- **Level 0 (Canvas Base)**: `#F8FAFC` flat surface, no shadow.
- **Level 1 (Cards, KPI Blocks, Table Shells)**: `#FFFFFF` fill, 1px solid border `#E2E8F0`, shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.04)`.
- **Level 2 (Dropdowns, Flyouts, Popovers)**: `#FFFFFF` fill, 1px solid border `#CBD5E1`, shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modal Dialogs, AI Intelligence Panel)**: `#FFFFFF` fill, 1px solid border `#94A3B8`, shadow: `0 12px 28px -6px rgba(15, 23, 42, 0.14), 0 4px 10px -3px rgba(15, 23, 42, 0.05)`.
- **Level 4 (Header Bar Overlay)**: Background `#0F172A`, 1px solid bottom divider `#1E293B`, shadow: `0 1px 3px 0 rgba(0, 0, 0, 0.25)`.

## Shapes

### Compact Precision Geometry
Construction enterprise dashboards demand a crisp, structured corner language that aligns tightly with analytical data grids and blueprints.
- **Base Geometry (`roundedness: 1`)**: Standard elements (buttons, inputs, status badges) adhere to `0.25rem` (4px).
- **Cards & Data Grids**: Container frames employ `rounded-lg` at `0.5rem` (8px).
- **Pills**: Circular/pill geometry (`9999px`) is reserved solely for live telemetry status dots and status badge indicators to maximize semantic differentiation from rectangular structural cards.

## Components

### Buttons
- **Primary Action**: Solid `#0F172A` background, `#FFFFFF` text, 4px border radius. Hover state transitions to `#1E293B`. Active state `#020617`.
- **Accent Action**: `#2563EB` background with `#FFFFFF` text for core system triggers (e.g., "공정 승인", "Export").
- **Secondary Outline**: `#FFFFFF` background, 1px border `#CBD5E1`, `#334155` text. Hover: `#F8FAFC`.
- **Destructive**: `#DC2626` background, `#FFFFFF` text.

### Badges & Status Chips
Badges use `badge-label` typography with a 4px padding-x and 2px padding-y:
- **Normal Chip (정상)**: `#ECFDF5` background, `#059669` text, 1px border `#A7F3D0`. Prefixed with a 6px solid emerald dot.
- **Warning Chip (주의)**: `#FFFBEB` background, `#D97706` text, 1px border `#FDE68A`.
- **Inspection Needed Chip (점검)**: `#FEF2F2` background, `#DC2626` text, 1px border `#FECACA`.

### Data Tables & Expandable Rows
- **Table Header**: `#F8FAFC` background, height 36px, typography `11px` bold uppercase `#64748B`, 1px bottom border `#E2E8F0`.
- **Table Cells**: Height 44px (compact mode 36px), border-bottom 1px solid `#F1F5F9`, typography `data-mono` for numbers and `body-compact` for text.
- **Expandable Row Interaction**:
  - Hover state shifts row to `#F8FAFC`.
  - When expanded, trigger row retains `#F1F5F9` background with a 2px left border accent in `#2563EB`.
  - Nested container sits within `#FAFAFA` sub-well with inset shadow and 1px border outline `#E2E8F0`.

### KPI Metric Tiles
- Structure: 8px rounded white card with 1px border `#E2E8F0`.
- Padding: 16px desktop, 12px mobile.
- Header: Micro label (`12px`, `#64748B`) followed by top-right indicator badge.
- Metric: `headline-kpi` bold tabular number paired with inline trend delta icon (e.g., `▲ +2.4pp` or `▼ -6.1pp`).

### AI Conversational Assistant Panel
- Structure: Right-aligned dock or modal sheet (`380px` wide).
- Header: `#0F172A` background with crisp white typography and operational project badge.
- Message Bubbles:
  - User: `#F1F5F9` background, `#1E293B` text, 4px corner radius.
  - Assistant: `#FFFFFF` card, 1px solid `#E2E8F0` with direct deep-links to table rows and KPI citations.
- Input Box: Integrated prompt bar with hairline border `#CBD5E1`, submit trigger locked to `#2563EB`.

### Form Controls (Inputs, Checkboxes, Radios)
- **Input Fields**: Height 36px, background `#FFFFFF`, border 1px solid `#CBD5E1`, typography `14px`. Focus: 1px border `#2563EB` with an ambient `0 0 0 2px rgba(37, 99, 235, 0.15)` focus ring.
- **Checkboxes & Radios**: 16x16px boundary, 2px border radius for checkboxes, full circle for radios. Selected state `#0F172A` fill with white checkmark glyph.