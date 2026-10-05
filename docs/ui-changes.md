# UI overhaul: what changed (2026-10-05)

Branch `ui-overhaul`, starting from `84bffc4`. This change touches the presentation layer only. API calls, data fetching, auth and state are as they were. There are two small additions to routing and navigation: a real 404 page, and Home shortcuts that link to existing tool URLs. The problems this fixes are listed in `docs/ui-audit.md`.

## Design system

**Direction: "study desk".** The interface is quiet and editorial. Hierarchy comes from type weight, whitespace, background tone and hairline dividers rather than boxes. Blue is the only accent. Colour is used for meaning: the accent, and status.

### Colour tokens
Defined in `client/src/theme/palette.js`. Each token is a CSS variable with a light and a dark value, and is exposed as a Tailwind colour.

| Token | Use |
|---|---|
| `canvas`, `raised`, `sunken`, `overlay` | page, cards and panes, wells and sidebars, menus and dialogs |
| `line-subtle`, `line`, `line-strong` | dividers, control borders, emphasis |
| `fg`, `fg-muted`, `fg-subtle`, `fg-disabled` | text, from primary to disabled |
| `accent` (+ `hover`, `soft`, `fg`), `on-accent`, `focus` | actions, selection, links, focus ring |
| `success`, `warning`, `danger`, `info` (each + `soft`, `fg`) | status: dot or bar / soft fill / text on it |
| `chart-1…6`, `chart-grid/track/axis/line` | chart series and scaffolding |

- **Neutrals** are tinted towards blue-slate in both themes.
- **Dark mode** is its own palette, not an inversion: a charcoal canvas `#0E1217`, raised `#151A21`, sunken `#0A0D11` and overlay `#1B212A`.
- **Contrast:** every text/background pair has been checked to WCAG AA (4.5:1), and the focus ring to 3:1, in both themes, including on the selected-row tint.
- **Older classes:** `gray-*`, `blue-*` and the other ramps still resolve through the same variables. New code uses only the semantic tokens, and `__tests__/themeGuard.test.js` enforces this.

### Type
- **Fonts:** Geist for the interface and headings, and Geist Mono for code only. Raleway 700 is used only for the NOVARD-AI wordmark.
- **Scale:**

  | Name | Size / line height | Used for |
  |---|---|---|
  | `micro` | 11/14 | chart axes |
  | `caption` | 12/16 | |
  | `small` | 13/18 | |
  | `body` | 14/22 | |
  | `lead` | 16/24 | |
  | `title` | 20/28 | |
  | `display` | 28/34 | page H1 |
  | `hero` | 44/48 | landing page only |

  `title` and `display` have tighter tracking. The Tailwind names (`text-xs` … `text-6xl`) are aliased onto these steps.
- **Numbers:** the `.num` class gives tabular figures for stats and counts.
- **Case:** labels are sentence case. There are no uppercase tracked labels.

### Shape, space, elevation, motion
- **Radius:** `sm` 4px, `md`/default 6px (controls), `lg` 8px, `xl` 10px (containers). `2xl` and `3xl` were removed.
- **Spacing:** the Tailwind 4px grid. Arbitrary text sizes are banned.
- **Shadows** are for elevation only: `shadow-raised` (a 1px hairline), `shadow-popover` and `shadow-modal`. They scale up in dark mode through `--shadow-strength`.
- **Motion:** 150–200ms transitions. A global reduced-motion reset turns off transitions and looping animation.
- **Focus:** one 2px `focus` outline everywhere, keyboard only (`:focus-visible`).

### Icons
There is one set: Lucide (through react-icons) in `components/ui/Icon.jsx`, plus one custom glyph drawn to the same grid and stroke: the Novard Agent mark (`AgentMark`, `<Icon name="agent" />`): the curved four-point star of the agent orb, static and flat, with a small companion sparkle. It is used for the agent in the sidebar, the top bar, the chat header and, in white on a blue disc, the agent's avatar. The floating launcher keeps the original animated orb.

Icons are used as `<Icon name="…" />` with a 1.75 stroke. It replaces the hand-written SVG paths, Feather and Material icons. There is no emoji anywhere in the interface.

## Components created (`client/src/components/ui/`)

| Component | What it is |
|---|---|
| `Button`, `IconButton`, `buttonClass()` | variants primary / soft (quiet blue) / secondary / ghost / danger / danger-solid / inverse / link; sizes xs–lg; `loading`. An icon-only button requires a label. |
| `Input`, `Textarea`, `Select`, `Field`, `inputClass`, `fieldClass` | one field style. `Select` is a styled native select: keyboard, screen-reader and mobile behaviour stay native. |
| `Badge`, `Status` | soft-fill label; a dot plus text for lists and tables |
| `Avatar` | photo with an initials fallback |
| `EmptyState`, `ErrorState`, `Skeleton`, `SkeletonText`, `SkeletonRows`, `LoadingBlock` | real empty, error and loading states, with no icon tiles |
| `PageHeader`, `SectionHeader`, `Card` | page title, description and actions; section heading; a raised surface, used sparingly |
| `StatStrip`, `Stat` | numbers in one hairline-divided strip; captions wrap to two lines |
| `ListRow` | divided list row; selected rows get a soft tint |
| `Modal`, `confirm()`, `useFocusTrap` | portal dialog with focus trap, Escape, focus return and scroll lock; a promise-based replacement for `window.confirm` |
| `Menu`, `MenuItem`, `MenuSeparator`, `MenuHeader` | dropdown with arrow, Home and End keys, Escape, outside click and focus return |
| `Tooltip` | hover and focus label |
| `Tabs`, `SegmentedControl` | underline tabs and a pill control, with roving focus and arrow keys |
| `Toast` | the one toast style; both older toast APIs render it |

**Layout** (`client/src/components/layout/`):
- `AppShell` is the frame of every student page. It provides:
  - the breadcrumb and tab title, taken from `lib/pages.js`;
  - a `default` page column that fills the screen up to `max-w-screen-2xl` (1536px), or a `full` workspace;
  - a right strip kept free for the agent launcher;
  - a skip link.
- `Breadcrumbs`.
- `ToolIndex` and `ToolAside`, for the hub pages.

**One name per page** (`client/src/lib/pages.js`): Home · Career · Doubts & Notes · Forum · Skill Plans · Videos · Profile · Settings · My reports. Tools inside pages: Smart Roadmap, Skill Gap Analysis, Notes & Quiz, Doubt Clearance, Video Library, Video Summarizer. The sidebar, breadcrumb, H1 and browser tab all read from this file.

## Per page

### App shell
**Sidebar**
- The active page is a soft blue tint with blue text and icon.
- 280px wide (the `sidebar` spacing token), 40px rows with 20px icons, grouped as Learn / Grow / You, with a distinct icon for each page.
- The active item is a quiet raised chip; there is no edge bar.
- Below 1024px it becomes a drawer with a focus trap and Escape.
- The user's card was removed from the footer, so the user now appears in one place only.

**Top bar**
- A breadcrumb replaces the uppercase title that repeated the H1.
- On the right: theme, notifications, and one account menu (Menu primitive). On phones, the theme options are inside the account menu.

**Agent launcher**
- The original animated Novard orb, at 48px, without the label pill or the green ping (it stops under reduced motion).
- It sits in a strip the shell keeps clear, so it can no longer cover the forum's "Post reply" or any field.
- It now appears on every page. On phones it moves into the top bar.

**Other**
- A real 404 page; legacy URLs still redirect.
- The loading fallback is shaped like the app frame.
- The error screen was restyled.

### Pages

**Home**
- One stat strip replaces four emoji tiles.
- "Start something" shortcuts lead straight into Notes, Doubt Clearance, Skill Plans and the Video Summarizer. They replace the fake "new model" banner; its Skill Plans link is kept.
- The weekly chart, proficiency and strengths charts are on tokens.
- The agent's welcome screen shows the same orb.
- Loading uses skeletons, and errors show an error state with retry.

**Career, Doubts & Notes, Videos**
- Tool cards: a blue icon chip, the name, one specific sentence, what you get, and a blue "Open …" action; the card outline turns blue on hover. The follow-up aside is a soft blue panel with a primary button.
- The dark gradient promo banners became a quiet aside that keeps its action. "Start a mock interview" and "Suggest topics" still open Novard Agent with the same prompt.

**Smart Roadmap, Skill Gap Analysis**
- The shared split frame, with the list on the left.
- Calmer forms; the roadmap stages are numbered.
- AgentAvatar replaces the compass emoji.

**Notes & Quiz, Doubt Clearance, Video Library, Video Summarizer**
- One framed split pane with underline tabs.
- Chat uses AgentAvatar, and summaries are laid out as articles.
- Quizzes are divided questions with explained answers.
- While content is generating, a skeleton shows the shape of the result.
- The add-new forms have no nested boxes.
- Video cards are a thumbnail plus text.
- Deleting asks through a designed confirm dialog.
- Toast timers no longer cut a newer toast short.

**Forum**
- A dense discussion list replaces the three-column card grid. Votes and replies sit in aligned columns.
- The filters are styled selects.
- The thread reads like a document, with the composer pinned in the frame.
- "New discussion" uses Modal, and its submit button reads "Post discussion".

**Skill Plans** (was "My Learning" / "Skill Unlocker")
- A two-column form with styled selects and no 🚀.
- The plan is a day-by-day list with compact video rows, a progress bar and "Take the quiz".
- The quiz shows one question at a time.
- The result is shown as stats with a plain headline instead of trophy emoji.

**Profile**
- No gradient cover.
- Account details sit on one divided row.
- The goal has a line icon.
- The six stats are one strip with no rainbow bars, and captions wrap.
- "What you have made" is an icon list instead of eight emoji tiles.

**Settings**
- Rows with a label column and a control column. Appearance uses a segmented control.
- The fake "coming soon" boxes were replaced by rows linking to Profile and My reports.

**My reports** and the **Report-a-problem** dialog
- My reports uses PageHeader, skeletons and a divided conversation.
- The dialog uses Modal and the styled Select.

**Novard Agent**
- Now a page inside the app (sidebar item "Novard Agent", under Home): the main sidebar stays visible, the chat history is a pane inside the frame (a drawer on phones), the breadcrumb shows the open chat. The floating orb stays as a shortcut on other pages.
- The static agent mark.
- Starter rows with icons replace the emoji tiles.
- Composer and action cards are on tokens, with no icon tiles.
- The draft and learner-profile selects are styled.
- "Back to Home".

**Landing**
- Specific copy and one "Continue with Google" action.
- A still of the real product replaces the fake stats bento.
- The tools are a plain list, followed by "How it works".
- A footer without dead links.

**Admin sign-in:** plain, with no gradient.

**Admin console** (shell and primitives only, as agreed)
- The same sidebar and top bar, with a breadcrumb.
- `admin/ui.jsx`, `DataTable`, stat strips and selects are on the system.
- Every admin page went through the token sweep; layouts are unchanged.

## Tests and checks
- `npm run test:ci`: 77 tests pass. Changes made to tests:
  - The admin shell test now looks for the breadcrumb instead of the uppercase title.
  - The IssueForm test uses "Post discussion".
  - `themeGuard.test.js` gained 7 rules: no ramp classes, no arbitrary text sizes, no old shadow names, no gradients, no emoji, no uppercase tracked labels, and no raw `<select>`.
- `npm run lint` is clean and `npm run build` compiles.
- **Screenshots:** 17 routes × light/dark × 1440px/375px. There is no horizontal scroll and no console errors (beyond expected 404s for a fresh test account).
- **axe-core (WCAG 2 A/AA):** clean on the checked pages after fixes. Those fixes covered nested interactive list rows, heatmap labels, and subtle-text contrast on the selected tint.
- **Keyboard:** the drawer traps focus and closes on Escape; the account menu supports arrow keys and returns focus.

### Not verified visually
- **Admin console pages:** checked by tests and the build only. I did not create an admin session.
- **Skill Plans planner and quiz with real data:** checked in code only. Generating a plan calls the AI.
