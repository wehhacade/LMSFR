# LMSBR UI structure

The LMSBR interface is a gold-on-stone design system. Almost every screen is inline styles plus CSS keyframes, not Tailwind component classes. The pieces that repeat everywhere are the emblem mask, the grain overlay, and three small toggle pills.

## Screen stack

```
Root layout (Poppins, ThemeProvider, ColorPaletteProvider)
├── Login          /login                 LoginScreen
├── Launcher       /dashboard             module cards
└── Workspace      /dashboard/[module]    ModuleWorkspace
    ├── vertical sidebar   (desktop, default)
    ├── horizontal top nav (desktop, optional)
    └── mobile drawer      (≤ 859px)
```

`frontend/src/app/(dashboard)/layout.tsx` paints the page background. `frontend/src/components/lmsbr/module-workspace.tsx` paints the chrome on top of it: sidebar or top nav, sticky header, page content.

## Login

`frontend/src/components/lmsbr/login-screen.tsx` is a full-viewport stage, centered card, max width 430px.

Layers, back to front:

1. **Page gradient.** Dark gold is a warm radial wash over `#070504`. Dark navy swaps the wash to `#070F26`. Light is a flat `#F5F5F4`.
2. **Grain.** A repeating SVG fractal-noise tile, opacity `0.045` in dark and `0.025` in light, `mix-blend-mode: multiply`.
3. **Three blurred orbs** (`orb-float-a/b/c`, 10–15s) in gold.
4. **Four concentric rings** around the logo, solid and dashed, spinning clockwise and counter-clockwise (`is-spin` / `is-spinrev`, 40–100s).
5. **Stars and shooting stars** (`is-twinkle`, `is-shoot`). Stars dim to 40% opacity in light mode.
6. **Top-right pills:** appearance toggle, then EN / SO.
7. **The card.** Emblem (64px, floating), `✦ ✧ ✦`, gradient wordmark `LMSBR`, then the form. In dark mode the card pulses with `card-glow`. The submit button has a shine sweep (`btn-shine`).

The wordmark uses class `lmsbr-title`, which clips the gradient to the text.

## Background pattern

There is no tiled wallpaper image. The texture is that same inline SVG noise, reused in two places:

- Login: full page, `multiply`.
- Dashboard (`DashboardBg` in `frontend/src/app/(dashboard)/layout.tsx`): dark mode only, `soft-light`, opacity `0.045`, `z-index: 91`.

Dark mode also adds a tall central beam (`is-beam`, 6.5s) behind the content. Light mode drops both the grain and the beam and uses a flat gray page (`#F3F4F6`) so white cards sit above it.

The noise tile is an inline data-URI SVG:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#n)"/>
</svg>
```

## The emblem (sidebar and content)

The logo is not an `<img>`. A square `div` is filled with a gold gradient, then `/emblem.png` is used as a CSS mask, so only the emblem shape shows through the gradient.

`SidebarEmblem` in `module-workspace.tsx`:

- A beam sits behind the mark (`C.beamGrad`, animation `is-beam` 6.5s).
- The mark itself is a square with `maskImage: url('/emblem.png')`, `maskSize: contain`, `maskRepeat: no-repeat`, `maskPosition: center` (and the same `WebkitMask*` properties).
- Fill is `C.emblemGrad`. Opacity is `0.16` in dark and `0.14` in light. Blend mode is `C.emblemBlend`. It drifts with `is-drift` 9s.

The same mask is used in four sizes:

| Place | Size | Opacity | Blend | Motion |
|---|---|---|---|---|
| Login logo | 64px | full | drop-shadow | `is-float` 5s |
| Launcher bar | 40×38 | full | drop-shadow | none |
| Sidebar watermark | 300px (drawer 220px) | 0.16 dark / 0.14 light | `screen` dark, `multiply` light | `is-drift` 9s |
| Content watermark | `min(560px, 50vw)` | 0.13 dark / 0.12 light | same | `is-drift` 14s |

The gradient behind the mask:

- **Solid logo** (login, launcher): `linear-gradient(135deg, #f5dca6, #c69049 55%, #7a4e15)`
- **Dark watermark:** `radial-gradient(circle at 46% 40%, #fbeebc, #eccd7a 52%, #c89238 88%)` with `mix-blend-mode: screen`
- **Light watermark:** a darker gold radial (`#c89238` → `#6b4518`) with `mix-blend-mode: multiply`, so it stains the light background instead of glowing

The sidebar emblem sits in the flex column between the header and the prefs card, `pointer-events: none`, so menu clicks pass through it. The content emblem is `position: fixed`, `z-index: 100`, and its `left` / `width` animate for 0.5s when you switch sidebar mode, so it stays centered in the content area and not under the 268px sidebar.

## Layout

**Launcher** (`frontend/src/components/lmsbr/launcher.tsx`): sticky top bar (emblem + LMSBR, language, theme, bell, profile), then a welcome heading and a responsive card grid (`repeat(auto-fit, minmax(250px, 1fr))`). Cards pop in with a stagger (`is-pop`, delay `index * 0.09s`) and lift 6px on hover.

**Workspace**, three modes:

- **Vertical** (default on desktop): fixed sidebar, 268px, full height. Header (apps grid + module icon + name), scrollable menu, prefs card at the bottom. Main content gets `margin-left: 268px`.
- **Horizontal**: fixed 62px top bar. Apps button, module name, menu in a row, then the same three toggles plus the profile menu. Submenus drop down. Main content gets `padding-top: 62px` and no left margin.
- **Mobile** (`max-width: 859px` in `frontend/src/app/globals.css`): desktop sidebar and horizontal nav are `display: none`. A 58px top bar and a left drawer (`min(264px, 86vw)`) take over. The drawer slides with `translateX` over 0.4s. CSS is the source of truth here, so the layout does not wait on a JS breakpoint.

Inside the main area there is always a sticky header: module chip, chevron, current page, search, bell, profile. Page titles use Cinzel-style sizing (`clamp(24px, 3.2vw, 34px)`) and fade up once (`is-fadeUp .5s`).

Switching vertical ↔ horizontal animates `margin` and `padding` with `cubic-bezier(.4, 0, .2, 1)` over 0.5s.

## Sidebar toggle

The control is `NavModeToggle` in the sidebar footer (vertical) or the top bar (horizontal). Two icons from `frontend/src/components/lmsbr/icon.tsx`:

- `sidebar` — left rail, sets `vertical`
- `header` — top bar, sets `horizontal`

The active side is a gold gradient pill (`linear-gradient(120deg, #c69049, #a36f2a)`), text `#100d0a`. The inactive side is transparent.

`setNavModePersisted` writes three places at once:

- React state
- `localStorage["lmsbr-navMode"]`
- cookie `lmsbr_nav_layout` (30 days)
- `data-nav-layout` on `<html>`

`frontend/src/components/lmsbr/theme-init-script.tsx` reads that before paint so the sidebar does not flash the wrong mode. On a phone the toggle is stored, but CSS still forces the drawer until the viewport is wider than 859px.

Persistence lives in `frontend/src/lib/lmsbr/module-nav-persist.ts`. Default mode is `vertical`.

## Theme toggle

`frontend/src/components/lmsbr/color-toggle.tsx` is one pill with three buttons:

1. **Sun / moon** — flips light ↔ dark. Calls `useTheme().toggle()`, which sets `data-theme`, the `dark` class, `color-scheme`, and `localStorage["lmsbr-theme"]`. Default is light.
2. **Gold swatch** `#c69049` — dark palette `gold`.
3. **Navy swatch** `#070F26` — dark palette `navy`.

Palette only applies in dark mode (`applyPalette` in `frontend/src/lib/lmsbr/palette.ts`). Clicking a swatch while in light mode switches to dark and then applies that palette. Stored in `localStorage["lmsbr-palette"]` and `data-palette`.

Light tokens live inline as `LT` in `module-workspace.tsx` and `login-screen.tsx`. Dark tokens live in `frontend/src/lib/lmsbr/theme-tokens.ts` (`DASHBOARD_DARK`, `LOGIN_DARK`). Navy replaces the brown surfaces and keeps the gold accents.

Providers:

- `frontend/src/components/lmsbr/theme-ctx.tsx` — `Theme` is `"dark" | "light"`.
- `frontend/src/components/lmsbr/color-palette-ctx.tsx` — `ColorPalette` is `"gold" | "navy"`.

## Colors

**Shared gold**

- Accent `#c69049`, highlight `#e2b667` / `#f5dca6`, deep `#7a4e15` / `#a36f2a`
- Danger `#e0655a`
- Active control gradient `120deg, #c69049 → #a36f2a`

**Light**

- Page `#F5F5F4` / workspace `#F3F4F6`
- Cards `#FFFFFF`, borders `#E5E7EB`
- Text `#111827` / `#1A365D`, muted `#6B7280`
- Shadows are real elevation (`0 1px 3px` plus a wider soft shadow), not glows

**Dark gold**

- Page `#070504`, sidebar `linear-gradient(180deg, #120c07, #080603)`
- Cards `linear-gradient(160deg, #120d08, #0a0704)`
- Borders `rgba(214, 176, 114, 0.14–0.18)`
- Text `#f3ead9`, secondary `#b6a589`, muted `#9a8a6f`

**Dark navy**

- Page `#070F26`, sidebar `linear-gradient(180deg, #0c1835, #070F26)`
- Same gold borders and text

Each module also has its own accent, used for the active menu wash, the module chip, and the launcher card. Values come from `frontend/src/lib/lmsbr/data.ts`:

| Module | Accent |
|---|---|
| Amniga | `#e6b25c` |
| Survey | `#3fd0b5` |
| Baaris | `#4db8a0` |
| Visitors | `#c48a3a` |
| Hub | `#5b9fd4` |
| Dhacdooyin | `#f0a04a` |
| User control | `#9d8ef5` |

Active vertical menu item: gold-tinted gradient, inset ring, soft shadow. Hover nudges it 3px to the right. Radius is consistent: controls 9–11px, menu rows 12px, cards 14px, login card 24px.

## Icons

All chrome icons are one component, `frontend/src/components/lmsbr/icon.tsx`. They are 24×24 stroke SVGs, `stroke="currentColor"`, default stroke width `1.8`. Pass a name:

```tsx
<Icon name="shield" size={21} sw={1.8} />
```

Names used in the shell: `grid`, `sidebar`, `header`, `menu`, `home`, `shield`, `search`, `bell`, `chevron`, `chevdown`, `sun`, `moon`, `logout`, plus the module icons (`clipboard`, `badge`, `users`, `calendar`, `archive`, `box`, and others). Menu items store the icon name as a string in `frontend/src/lib/lmsbr/data.ts`.

## Fonts

`frontend/src/app/layout.tsx` loads **Poppins** (weights 300–800) as `--font-poppins`.

In `frontend/src/app/globals.css`, both design names point at that same font:

```css
--font-outfit: var(--font-poppins);
--font-cinzel: var(--font-poppins);
```

The code still says “Cinzel” for titles and “Outfit” for UI, but both render as Poppins.

- **Titles** (`var(--font-cinzel)`): module name, page `h1`, launcher heading, login wordmark. Weights 600–800, wide letter-spacing (`.16em`–`.4em` on labels).
- **UI** (`var(--font-outfit)`): body, menus, inputs, buttons. Sizes 11–15px. Labels are often uppercase with `.06em`–`.18em` tracking.

## Motion

Defined in `frontend/src/app/globals.css` under “LMSBR Design Animations”. The ones the shell actually uses:

| Name | What it does | Where |
|---|---|---|
| `is-fadeUp` | rise 16px + fade, ~0.5–0.7s | login card, page titles, submenus |
| `is-pop` | rise + scale from 0.94 | launcher cards |
| `is-drift` | 7px vertical float | watermarks |
| `is-float` | 14px float | login emblem |
| `is-beam` / `is-glow` / `is-halo` | opacity + scale pulse | beams, sidebar glow, icon halos |
| `is-shine` / `btn-shine` | skewed light sweep | cards, login button |
| `is-spin` / `is-spinrev` | full rotation | login rings |
| `is-twinkle` / `is-shoot` | stars | login |
| `is-grow` | `scaleY(0→1)` | dashboard bars |
| `orb-float-*` | orbs drift and scale | login |
| `card-glow` | gold box-shadow pulse | login card, dark only |

Theme and surface changes use a plain `transition: background .4s, color .4s`. Layout changes use the 0.5s ease curve above. Hover on menu and cards is `.2s`–`.35s`.

## Where to look

| Concern | File |
|---|---|
| Root font + providers | `frontend/src/app/layout.tsx` |
| Keyframes, scrollbar, mobile shell | `frontend/src/app/globals.css` |
| Login stage | `frontend/src/components/lmsbr/login-screen.tsx` |
| Module launcher | `frontend/src/components/lmsbr/launcher.tsx` |
| Sidebar, top nav, watermarks | `frontend/src/components/lmsbr/module-workspace.tsx` |
| Dashboard background | `frontend/src/app/(dashboard)/layout.tsx` |
| Dark tokens | `frontend/src/lib/lmsbr/theme-tokens.ts` |
| Navy palette + page backgrounds | `frontend/src/lib/lmsbr/palette.ts` |
| Light / dark toggle | `frontend/src/components/lmsbr/theme-ctx.tsx` |
| Gold / navy toggle | `frontend/src/components/lmsbr/color-palette-ctx.tsx` |
| Appearance pill | `frontend/src/components/lmsbr/color-toggle.tsx` |
| Sidebar mode persistence | `frontend/src/lib/lmsbr/module-nav-persist.ts` |
| Flash-free theme + nav on load | `frontend/src/components/lmsbr/theme-init-script.tsx` |
| Icons | `frontend/src/components/lmsbr/icon.tsx` |
| Module accents and menu icons | `frontend/src/lib/lmsbr/data.ts` |
