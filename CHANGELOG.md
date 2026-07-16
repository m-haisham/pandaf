# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **vuedo:** Split HTML wrapping into per-section `wrapBody`, `wrapHeader`, and
  `wrapFooter` functions. Header/footer get `!important` resets and a negative
  margin pull into their reserved Gotenberg band; `wrapHtml` is now a deprecated
  alias for `wrapBody`.

### Added

- Initial public structure: `@hshm/vuedo` library (`createPdfKit`, `renderHtml`,
  `renderComposite`, `generatePdf`) with Vue SSR → asset-inlined HTML → Gotenberg
  pipeline.
- `@hshm/vuedo/vite` Vite plugin and `vuedo` CLI for template compilation,
  manifest emission, and `PdfTemplateProps` type generation.
- Example Elysia consumer with per-template typed routes (invoice, pos) and
  `?preview=html` support.
- File-based layout discovery (body + paired header/footer) and Tailwind/asset
  inlining (Base64) for offline rendering.

[Unreleased]: https://github.com/hshm/vuedo/commits/main
