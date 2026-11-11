# PixelCake frontend

The application itself: canvas, reachability check, terminal, import and export. It runs entirely in the browser. What the app does and does not do is in the [main README](../README.md).

Built with React 19, TypeScript, Vite, React Flow 11, Zustand and Tailwind CSS 3.

## Commands

Use pnpm, not npm.

```bash
pnpm install       # install dependencies
pnpm dev           # development server on http://localhost:5173
pnpm build         # type-check and build into dist/
pnpm preview       # serve the built app locally
pnpm test:run      # run the test suite once
pnpm test          # run the tests in watch mode
pnpm type-check    # TypeScript only
pnpm lint          # ESLint, zero warnings allowed
pnpm format        # Prettier
```

## Source layout

```
src/
  engine/       reachability check and flow models; pure TypeScript, no UI imports
  terminal/     command parser (pure) and executor (the only part that touches the stores)
  components/   Canvas, Sidebar, Toolbar, Modals, ui
  store/        Zustand stores, persisted in the browser's local storage
  utils/        auto-layout, IP helpers, YAML and Terraform export, YAML import
  api/          HTTP client for the optional backend
  types/        shared TypeScript types
```

Imports use the `@/` alias for `src/`.

## Notes

- **Backend address.** The app calls `http://localhost:8000` by default. Set `VITE_API_URL` to change it. With no backend, the app keeps working from local storage.
- **Tailwind stays on version 3.** If version 4 gets installed by mistake, run `pnpm add -D tailwindcss@3`.
- **Type-only imports** must be written as `import { type Foo }`, because `verbatimModuleSyntax` is on.
- **Icons** come from Iconify and are fetched at run time.
