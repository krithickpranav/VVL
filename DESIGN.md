---
name: Logistics & Transport Accounting
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fe932c'
  on-secondary-container: '#663500'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002114'
  on-tertiary-container: '#069669'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system delivers a professional, dependable, and highly functional environment tailored for non-technical office staff managing logistics and transport accounting. The brand personality is grounded, precise, and authoritative, minimizing cognitive load during data-heavy financial operations.

The aesthetic adopts a Corporate / Modern style characterized by high-contrast visual cues, crisp surfaces, and zero ambiguity. It evokes an immediate sense of trust, operational safety, and financial accuracy, ensuring error-free data entry and rapid transaction auditing.

## Colors

The color architecture is built for extreme clarity and instant financial comprehension. 

- **Primary (Deep Navy `#0F172A`):** Anchors the interface, used for primary navigation, primary action buttons, and high-emphasis headers.
- **Secondary (Gold/Amber `#D97706`):** Applied selectively to critical accents, active states, and calls-to-action that require user attention.
- **Tertiary (Emerald Green `#059669` & Soft Red `#DC2626`):** Dedicated entirely to financial values. Emerald represents positive cash flow and credits; soft red highlights expenses, debits, and deficits.
- **Neutrals (Slate Gray `#64748B` & Crisp White `#FFFFFF`):** Form the background canvases and structural card containers, establishing a high-contrast layout that reduces eye strain during extended work sessions.

## Typography

The typography system relies exclusively on **Inter** for uncompromising legibility across dense data tables, invoices, and ledgers. Numeric data should consistently utilize tabular (monospaced) figures to ensure effortless vertical scanning of monetary amounts and freight IDs. Font sizes strictly respect accessibility thresholds, avoiding sub-12px text for essential data.

## Layout & Spacing

The layout is structured around a **fixed grid** framework optimized for desktop-first enterprise office environments (12-column grid with 24px gutters and 32px outer canvas margins). 

- **Density:** While spacious enough to prevent accidental mis-clicks, the layout uses predictable vertical rhythms (`space-md` and `space-lg`) to balance dense ledger views with legible whitespace.
- **Responsiveness:** On smaller viewports, multi-column financial tables reflow into stacked, card-based summaries with horizontal scrolling restricted to secondary data columns.

## Elevation & Depth

Visual hierarchy relies on clean surface separation and low-contrast outlines rather than heavy drop shadows. 
- **Surfaces:** Use crisp white cards (`#FFFFFF`) layered over a cool slate canvas (`#F8FAFC`). 
- **Boundaries:** Define containers using subtle border strokes (`#E2E8F0`) to ensure explicit data grouping. 
- **Interactivity:** Hover and active states elevate elements via subtle tonal shifts and amber accent rings, maintaining a flat, highly legible corporate aesthetic.

## Shapes

The shape language employs a soft, structured geometry (`roundedness` level 1). Interactive elements feature a modest 0.25rem to 0.5rem radius, conveying approachability and modern utility without sacrificing the formal precision required in accounting software. Full pill shapes are reserved exclusively for status badges (e.g., "Paid", "In Transit", "Overdue").

## Components

- **Buttons:** High-contrast, large touch targets (minimum 44px height). Primary actions use Deep Navy (`#0F172A`) with crisp white labels; secondary actions feature outlined slate borders; call-to-actions utilize Gold/Amber (`#D97706`).
- **Input Fields:** Generous padding with clear, persistent top labels. Active fields feature a prominent amber focus ring and high-contrast text to facilitate rapid data entry.
- **Cards:** Crisp white containers set against the slate background, used to group invoice summaries, shipment totals, and account balances.
- **Tables & Lists:** High-density data grids featuring alternating row backgrounds, sticky headers, and strict right-alignment for all monetary values. Positive values render in emerald green; negatives render in soft red.
- **Checkboxes & Radios:** Scaled up for rapid auditing and batch-selection workflows, utilizing clear check indicators.
- **Chips & Badges:** Rounded pill indicators for freight status, payment milestones, and category tags.
- **Additional Components:** Ledger summary widgets, freight cost calculators, audit trail timelines, and quick-filter toolbars for date ranges and transport hubs.