# UI audit (2026-10-05)

A read-only audit of the web client before the UI overhaul. All paths are relative to `client/src/` unless noted. Line numbers refer to commit `84bffc4`.

## 1. Stack

| Area | What is there |
|---|---|
| Framework | Create React App 5 (`react-scripts`), React 18, react-router 6. Every page is `lazy()`-loaded behind one `Suspense` in `App.js`. |
| Styling | Tailwind 3.4 with `@tailwindcss/typography`. There is one global stylesheet, `index.css`. No CSS modules. |
| Component library | None. The custom primitives live in `components/learning/LearningUI.jsx` (imported by 33 files), `components/profile/blocks.jsx`, `components/admin/ui.jsx` and `components/ui/DataTable.jsx`. |
| Icons | Hand-written Heroicons-v1 outline SVG paths: the inline SVGs in `Sidebar.jsx`, the `Icon` map in `LearningUI.jsx:18-54` (about 30 names), and local maps in `agent/ActionCard.jsx:15`, `profile/ProfileHeader.jsx:31` and `IssueCard.jsx:4`. react-icons appears only in `ThemeToggle.jsx` (`fi`) and `pages/SkillUnlocker.jsx` (`md`). There are also 15+ files with raw `<svg>` inline. |
| Fonts | Google Fonts in `public/index.html:17-21`: Inter 300–900, Open Sans and Raleway. Open Sans (`font-body`) is never used. Raleway (`font-display`) is used 3 times, for the wordmark. |
| Charts | No library. Hand-built SVG and div charts in `profile/charts.jsx` and `analytics/*`. |

### How dark mode works
- `tailwind.config.js` sets `darkMode: 'class'`. `public/theme-init.js` adds `dark` to `<html>` before first paint, and `context/ThemeContext.jsx` keeps it in sync. The choice is saved to localStorage `novard_theme` and to the account through `PUT /api/auth/preferences`.
- `theme/palette.js` replaces Tailwind's palette with CSS variables (`rgb(var(--x) / <alpha-value>)`):
  - `gray-*` inverts (`DARK_GRAY`, lines 31-34).
  - Hue steps 50/100/200, used as backgrounds and borders, become dark tints (hue-500 mixed into `#121821`).
  - Hue text steps 600–950 become lighter steps.
  - `white`, `black` and `slate` never change.
- Named tokens (lines 39-61): `surface`, `surface-overlay`, `ink`, `ink-hover`, `on-ink`, `tooltip*`, `code*`, `chart-*`, `level-*`. `--shadow-strength` is 1 in light and 3 in dark.
- `__tests__/themeGuard.test.js` fails on `bg-white`, on `bg/from/via/to-gray-800/900/950`, and on hex or `rgb(` in JSX outside 5 own-palette files.

## 2. Routes and pages

| Route | File | Nav label | Top-bar title | Breadcrumb | H1 |
|---|---|---|---|---|---|
| `/` | `pages/Landing.jsx` | — | — | — | "Architect Your Future with AI" |
| `/home` | `pages/HomePage.jsx` | Home | HOME | — | "Welcome back, {name}! 👋" |
| `/career` (+ `?tool=roadmap`, `?tool=skills`) | `pages/Career.jsx` | Career Development | CAREER | Dashboard › Career Tools | "Career Development Tools" |
| `/doubts` (+ `?tool=notes`, `?tool=doubts`) | `pages/Doubts.jsx` | Doubts & Learning | DOUBTS & LEARNING | ‹ Dashboard › Doubts & Learning | "Doubts & Learning" |
| `/forum` | `pages/Forum.jsx` → `ForumGrid` / `IssueDetail` / `IssueForm` | AI Forum | AI FORUM | — | "AI Community Forum" |
| `/skill-unlocker` | `pages/SkillUnlocker.jsx` | My Learning | SKILL UNLOCKER | — | none (the H2 changes per view) |
| `/video` (+ `?tool=library`, `?tool=summarizer`) | `pages/Video.jsx` | Video Sessions | VIDEO SESSIONS | ‹ Dashboard › Video Sessions › Video Library | "Video Sessions & Learning" |
| `/profile` | `pages/Profile.jsx` | Profile | PROFILE | — | account name |
| `/settings` | `pages/Settings.jsx` | Settings | SETTINGS | — | "Settings" |
| `/reports`, `/reports/:ref` | `pages/Reports.jsx` | (account menu) | MY REPORTS | — | "My reports" |
| `/chatbot` | `pages/Chatbot.jsx` | (floating launcher) | own header | — | "Novard Agent" |
| `/admin/*` | `pages/admin/AdminApp.jsx` (15 pages) | admin sidebar | ADMIN · X | — | X |
| legacy `/roadmap`, `/skills-required`, `/doubt-clearance`, `/notes`, `/youtube-video-summarizer`, `/youtube-videos` | `LegacyRedirect` in `App.js:26-33` | | | | |
| `*` | `<Navigate>` to `/home` or `/` | | | | |

Sub-tools open inline in their hub: Smart Roadmap (`RoadmapInlineView` → `roadmap/*`), Skill Gap Analysis (`SkillsInlineView` → `skillgap/*`), Notes & Quiz (`NotesInlineView`), Doubt Clearance (`DoubtClearanceInlineView`), Video Library (`VideoLibraryInlineView`) and Video Summarizer (`VideoSummarizerInlineView`).

**Not present:**
- A Mock Interview page. Only the Career promo banner remains (`Career.jsx:153-180`); it sends a prompt to `/chatbot`.
- A 404 page.
- A login page apart from the Landing hero button and `pages/admin/AdminLogin.jsx`.

## 3. App shell and shared components

**Shell**
- There is no layout component. Every student page repeats `<Navigationinner title="…"/>` + `<Sidebar/>` + `<div className="ml-64 …">`.
- `Sidebar.jsx`:
  - It is fixed `w-64` and has no mobile behaviour on student pages.
  - Active item: `bg-blue-50 text-blue-600 font-medium border-r-4 border-blue-600` (line 182).
  - Doubts & Learning and My Learning use the same book path (lines 76 and 94).
  - The footer repeats the user's avatar and name, which the top bar already shows.
- `navigationinner.jsx`:
  - A hard-coded uppercase `title` (line 50), then ThemeToggle, NotificationBell and a user pill.
  - The account popover (lines 84-141) has no role, no Escape handling and no outside-click close.
- `ChatbotButton.jsx` (Novard Agent launcher):
  - `fixed bottom-8 right-8 z-50`, a 64px face plus a label pill, about 95px tall.
  - Endless spin, pulse and ping animations (`index.css:45-64`).
  - Added by hand on Home, Career, Doubts, Forum and SkillUnlocker; missing on Video, Profile, Settings and Reports.
- `ErrorBoundary.jsx` wraps `<App/>` in `index.js`, outside `ThemeProvider`.
- `RouteFallback.jsx` is a full-screen spinner.

**Primitives that exist** (`LearningUI.jsx` unless noted)
- Controls and forms: `btn` class strings, `inputClass`/`fieldClass`, `Field`, `FormPage`.
- Layout: `Workspace`, `Panel`, `ItemFrame`, `TabBar` (no arrow keys), `SideList`, `ListItem`.
- Status and feedback: `Badge`, `Toast`, `Spinner`, `EmptyState`, `GeneratingState`, `LoadingPanel`, `ListEmpty`.
- Content: `SummaryView`, `ChatPanel`, `QuizRunner`.
- Elsewhere:
  - `profile/blocks.jsx`: `Stat`, `SectionTitle`, `Card`.
  - `admin/ui.jsx`: `PageHeader`, `Section`, `LevelBadge`, `StatusLight`, `Loading`, `ErrorNote`.
  - `ui/DataTable.jsx`.
  - `ThemeToggle.jsx`: `ThemeOptions`.

**Primitives that are missing or duplicated**
- No Button component.
- No Select: there are 20 native `<select>`s.
- No Modal: 3 hand-rolled dialogs, none with a focus trap or focus restore.
- No Dropdown: 4 hand-rolled menus. ThemeToggle's is the only correct one.
- No Tooltip: each chart rolls its own.
- No Avatar: 5 copies.
- No shared Skeleton: there are 4 hand-rolled ones.
- Two toast systems:
  - `Notification.jsx`, used only by the Forum.
  - `LearningUI.Toast`. Each of the 4 inline views copies its own `showToast` helper with an uncleared `setTimeout`.
- `window.confirm` is used 7 times.

## 4. Known problems: confirmed

### Generic "AI template" patterns
**Boxes in boxes**
- `Settings.jsx:36`: three bordered gray boxes inside a bordered card.
- `ProfileHeader.jsx:23`: bordered detail icon boxes.
- `Profile.jsx:171-179`: 8 bordered tiles.
- `LearningPath.jsx:17-27`.
- Gray empty boxes inside chart cards: `StrengthsWeaknesses.jsx:50,79`, `SkillProficiencyRadar.jsx:57`, `charts.jsx:53,293`.
- `SkillUnlocker.jsx:433`.
- `LearningUI.jsx` `FormPage` (line 635) and `QuizRunner` (line 363).

**Tinted icon squares** (about 30 sites)
- Shared primitives: `LearningUI.jsx:111` (ItemFrame), `158` (EmptyState), `202` (SummaryView), `553` (ListEmpty), `611` (FormPage); `analytics/AnalyticsCard.jsx:34`.
- Pages and components:
  - `Career.jsx:125`, `Doubts.jsx:121`, `Video.jsx:123`
  - `IssueCard.jsx:57`
  - `ReportProblemDialog.jsx:167`
  - `ProfileHeader.jsx:23,173`
  - `agent/ActionCard.jsx:161`
  - `FeatureNotice.jsx:62`
  - `NotificationBell.jsx:90`
  - `ErrorBoundary.jsx:36`
  - `Settings.jsx:38`
  - Landing: 10 sites.

**Formulaic feature cards** (icon, title, gray text, "Get Started →")
- `Career.jsx:105-151`, `Doubts.jsx:103-147`, `Video.jsx:103-150`, `Landing.jsx:137-215,233-290`.

**Rainbow stat bars**
- `profile/blocks.jsx:10` draws an absolute `w-1` bar.
- Its colours come from `Profile.jsx:104-109` (primary, green, indigo, purple, amber, sky).
- Admin `Overview.jsx:29-32` and `Users.jsx:113-116` reuse it.

**Emoji in the UI** (37 lines in 13 files)
- `SkillUnlocker.jsx:508` "🚀 Generate Learning Plan" (also ❌ 374, 🧠 673, 🏆👏📚 765).
- `Career.jsx:158` "🎯 NOW LIVE".
- `ProfileHeader.jsx:173` goal 🎯.
- `HomePage.jsx:98,115,165-197,223` (👋 📊 ⚡ 🎯 ✓ 🔥 🚀).
- `Profile.jsx:24-31`: 8 tile emoji.
- `Chatbot.jsx:14-17`: suggestion emoji.
- `Doubts.jsx:154`, `Video.jsx:163`.
- `TestPerformance.jsx:42`.
- `VideoLibraryInlineView.jsx:24`.
- `SkillGapIntake.jsx:64` and `SkillGapChat.jsx:81,185` (🧭 used as an avatar).

**Gradients**
- Profile cover: `ProfileHeader.jsx:87-89`.
- Slate promo banners with pill badges:
  - `Career.jsx:154` "Practice with AI Mentors"
  - `Doubts.jsx:150`
  - `Video.jsx:153` (with blurred blobs)
  - `HomePage.jsx:219` ("NEW MODEL RELEASED", which no real feature backs)
- Gradient avatars: `IssueCard.jsx:90`, `LearningUI.jsx:219`, `admin/Assistant.jsx:64`.
- 18 `bg-gradient-to-*` in total.

**Native selects**
- Forum filters: `ForumGrid.jsx:119,124,129`.
- Skill plan form: `SkillUnlocker.jsx:402,420,438,455`.
- Report a problem: `ReportProblemDialog.jsx:197`.
- Agent: `agent/DraftForm.jsx:77`, `agent/LearnerProfilePanel.jsx:110`.
- Admin: 10 more.

**Heavy active nav state**
- `Sidebar.jsx:182` (filled tint plus `border-r-4`).
- Similar `border-l-4` selection in `RoadmapWorkspace.jsx:183`, `SkillGapWorkspace.jsx:182`, `SkillUnlocker.jsx:881`, `IssueDetail.jsx:321` and `LearningUI.jsx:526`.

**Vague marketing copy**
- `Career.jsx:100` "Empower your professional journey with our AI-driven toolkit…"; also `Career.jsx:14,164`.
- `Doubts.jsx:27,98,160`.
- `Video.jsx:20,98,174`.
- `HomePage.jsx:227`.
- `Settings.jsx:19,62-67` ("More Settings Coming Soon… Stay tuned").
- `SkillUnlocker.jsx:363`.
- `Landing.jsx:132,159,185,314`.

### Inconsistency
**Page names** differ between nav, top bar, H1 and breadcrumb (see the table in section 2):
- Career: "Career Development" / "CAREER" / "Career Development Tools" / "Career Tools".
- My Learning: the nav says "My Learning", the top bar says "SKILL UNLOCKER", and `LearningPath.jsx:57` and `ActionCard.jsx:48` also say "Skill Unlocker".
- Video: "Video Sessions" vs "Video Sessions & Learning" vs "Video Library".
- Home: the nav says "Home", every breadcrumb root says "Dashboard", and `AgentSidebar.jsx:173` says "Back to dashboard".

**Duplicated chrome**
- The uppercase top-bar title repeats the H1 on every page.
- The book icon is duplicated (Sidebar lines 76 and 94, `Doubts.jsx:17`).
- The user appears twice: the top-bar pill and the sidebar footer card.

**Page widths and alignment**

| Page | Width |
|---|---|
| Career, Doubts and Video hubs | `max-w-4xl`, left-aligned (the Career banner has no max width) |
| Forum | `max-w-7xl mx-auto` |
| Skill Plans | `max-w-5xl`, with forms at `max-w-3xl mx-auto` |
| Profile | `max-w-7xl` |
| Settings | `max-w-4xl mx-auto` |
| Reports | `max-w-5xl` |

**Workspace heights** are hard-coded per view (`calc(100vh-160px)`, `calc(100vh-200px)`, `calc(100vh-56px)`).

**Breadcrumbs** appear only on Career, Doubts and Video, and they differ (Career has no back chevron and uses `mb-6`; the others use `mb-4`).

**Two-pane layouts**
- Notes, Doubts and both Video tools share `Workspace` + `SideList`, with the list on the right at a fixed `w-72`.
- Roadmap, Skill Gap and SkillUnlocker each build their own layout (`w-80` aside, `border-l-4` selection).

**Headings**: `text-3xl` on most pages, but `text-2xl` on Profile and admin.

### Bugs and polish
**Launcher overlap**
- The forum reply bar (`IssueDetail.jsx:407`) uses `pr-24` to make room for the launcher, but the label pill still comes within a few pixels of "Post reply".
- The launcher also covers the bottom of the right-hand `SideList` in Notes and Doubts, and the controls at the bottom of the Roadmap and Skill Gap workspaces.

**Truncated stat captions**
- `profile/blocks.jsx:13` puts `truncate` on the caption, and the tiles are only about 160px wide (`xl:grid-cols-6` inside `ml-64 p-8`).
- Captions that get cut: `Profile.jsx:104,107,108` ("Time in the app · N active days", "Best N days · …"), plus admin `Users.jsx:114`.

**Forum layout**
- A 3-column grid of fixed-height cards (`ForumGrid.jsx:205`, `IssueCard.jsx:77-85`, `min-h-[3.5rem]`).
- Two posts leave most of the page empty, and the metadata can't be compared across rows.

### Other issues found
- **No mobile layout.** Student pages are unusable below about 900px because of `ml-64` and the fixed sidebar. Only admin and `/chatbot` have drawers.

**Accessibility**
- `IssueForm.jsx:56` modal has no role, no Escape handling and no focus trap.
- No dialog restores focus or locks body scroll.
- `TabBar` has no arrow-key support.
- Text glyphs are used as icons (✕ ▾ ↻ ↗).
- Many labels are 10–11px (`text-[11px]` ×65, `text-[10px]` ×26).

**Token bypasses**
- About 102 hex values. Most belong to their own palettes (Mermaid, ChatbotButton, AgentAvatar). The rest:
  - `lib/statusColors.js` `ACTIVITY_COLORS` and `readinessColor` are fixed hex and don't change with the theme.
  - `tailwind.config.js:97-99` uses `#3b82f6` for prose markers.
- About 194 Tailwind arbitrary values. Landing has its own clamp-based type scale (`Landing.jsx:7-113`).
- Status colour maps are defined separately in `SkillProficiencyRadar.jsx:13`, `StrengthsWeaknesses.jsx:3`, `TestPerformance.jsx`, `LearningPath.jsx:11` and `charts.jsx:197`.
- `blue-*` and `primary-*` are mixed in the same component (`SkillProficiencyRadar.jsx:73,144`).

**Radius, shadow and type spread**

| What | Count |
|---|---|
| `rounded-lg` | 208 |
| `rounded-full` | 131 |
| `rounded-xl` | 84 |
| `rounded-md` | 33 |
| `rounded-2xl` | 30 |
| `rounded-3xl` | 5 |
| `rounded-[…]` | 3 |
| `shadow-sm` | 38 |
| `shadow-lg` | 27 |
| `shadow-xl` | 18 |
| `shadow-md` | 13 |
| coloured blue shadows | 9 |
| type sizes in use | 11 Tailwind sizes plus 110 arbitrary |

Most shadows sit on cards at rest, not on anything elevated.

**Borders**: about 800 `border*` tokens, `border-gray-200` ×163. Borders are the main way hierarchy is shown.

**Fake content**
- "NEW MODEL RELEASED" (`HomePage.jsx:223`).
- "NEW CONTENT AVAILABLE" (`Doubts.jsx:154`).
- "masterclasses from top-tier industry professionals" (`Video.jsx:174`).
- The fake dashboard bento on Landing.

**Other**
- The ErrorBoundary sits outside ThemeProvider, so the error screen depends only on `theme-init.js` for dark mode.
- A possible bug in all four inline views: an older `showToast` timer can dismiss a newer toast early.

## 5. Tests a redesign must respect
- `__tests__/themeGuard.test.js`: the class and colour rules above.
- `pages/admin/__tests__/Admin.test.jsx`:
  - Text: `'NOVARD-AI'`, `'Admin console'`, `'ADMIN · RISK BOARD'` (the top-bar title), `'Sign in to NOVARD-AI admin'`.
  - A nav button with `aria-current="page"`.
  - Labels and buttons in Features & limits.
- `components/__tests__/Reports.test.jsx`:
  - `title="Report a problem with this"`, `'Send report'`, `'Record a voice note'`, `'Mark all as read'`.
  - aria-label `'Notifications, 2 unread'`.
  - Labels `/Which part of Novard-AI/` and `/What went wrong/`.
- `NotesInlineView.test.jsx`: labels `'Choose a PDF to upload'` and `'Ask a question about your notes…'`, the `'Send'` button.
- `IssueForm.test.jsx`: the `'Create Issue'` button.
- `AiLimitNotices.test.jsx`: the exact notice text.
- `context/__tests__/ThemeContext.test.jsx`: a toggle named `/change theme/i` and `menuitemradio` items.

## 6. Direction chosen
See the overhaul plan; the outcome is recorded in `docs/ui-changes.md` when the work is done.
- **Look:** "study desk", quiet and editorial. Blue-slate tinted neutrals, one blue accent, charcoal dark mode.
- **Hierarchy:** type, whitespace, background tone and hairline dividers rather than boxes.
- **Type:** Geist and Geist Mono.
- **Page names:** Home · Career · Doubts & Notes · Forum · Skill Plans · Videos · Profile · Settings.
