@AGENTS.md

## Design Rules

`DESIGN.md` (project root) is the design system spec for this app — tokens, typography, components, layouts/screens, and motion, all extracted from the actual code.

- **Trigger**: Treat a task as design work if it involves any of: creating/modifying UI components, changing styles (CSS/classes), using design tokens (color, typography, spacing, radius, shadow), changing layout/screen structure, or adding a new screen.
- **Before coding**: Read `DESIGN.md` first. At minimum, read the relevant sections — §3 Design Tokens, the matching component in §5, and the matching screen in §6.
- **Compliance**: Do not invent new colors or magic values. Use the existing tokens defined in `DESIGN.md` (CSS variables in `app/globals.css`). If a needed value is missing, add it consistently with the existing scale and tell the user you did so.
- **Sync**: When a design change lands (new/changed tokens, component variants or states, new screens), update `DESIGN.md` in the same task so code and docs stay in sync.
