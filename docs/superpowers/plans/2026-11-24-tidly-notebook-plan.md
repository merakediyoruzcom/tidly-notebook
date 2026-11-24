# Tidly Notebook — Single-File Personal Wiki Implementation Plan

> **For agentic workers:** Implemented task-by-task following strict zero-dependency Node 22 + single-file HTML compilation architecture.

**Goal:** Build **Tidly Notebook**, an advanced, customizable, mobile-friendly, 100% offline single-file `.html` personal wiki inspired by TiddlyWiki5, using a modular zero-dependency Node 22 build pipeline outputting `dist/tidly-notebook.html`.

**Tech Stack:** Vanilla ES Modules (`src/`), CSS Custom Properties, HTML5 Canvas, Web Crypto API (`PBKDF2-SHA256` + `AES-256-GCM`), IndexedDB + `localStorage`, Node 22 (`node:test`, `node:assert`, `vm`, `http`, `fs`, `path`).

**Spec:** `docs/superpowers/specs/2026-11-24-tidly-notebook-design.md`

## Tasks
1. Project scaffold, spec/plan docs, `src/core/utils.js`, `src/core/i18n.js`
2. Tiddler Store Engine (`src/core/store.js`, `test/store.test.js`)
3. Pipeline Filter Language Engine (`src/core/filter.js`, `test/filter.test.js`)
4. Markdown + WikiText Parser, Transclusion, Macros & XSS Sanitizer (`src/core/parser.js`, `test/parser.test.js`)
5. Encryption (`src/core/crypto.js`), Formats (`src/core/formats.js`), Single-File Serializer (`src/storage/serializer.js`), Persistence (`src/storage/persistence.js`)
6. Starter Tiddlers (`src/seed/starter-tiddlers.js`), HTML Template (`src/template.html`), Compiler (`build.mjs`), Dev Server (`dev-server.mjs`), Build Tests (`test/build.test.js`)
7. CSS Design System (`tokens.css`, `layout.css`, `components.css`), Icons (`icons.js`), Theme Engine (`theme.js`)
8. Interactive UI Modules (`modals.js`, `editor.js`, `river.js`, `sidebar.js`, `graph.js`, `app.js`)
9. Full build, test suite, and live desktop + mobile browser verification
