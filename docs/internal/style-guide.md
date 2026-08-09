# Style Guide

This is a minimal writing guide for documentation in this repository.
A more comprehensive guide is out of scope for v2.7.0 and will be added in a future release.

## Core Principles

- **Short sentences.** Aim for one idea per sentence.
- **Active voice.** Write "The simulator runs 10,000 paths" not "10,000 paths are run by the simulator."
- **Plain vocabulary.** Prefer common words. Avoid jargon unless defined on first use.
- **Define terms on first use.** Introduce abbreviations in full before using them (e.g., "Cash Buffer (CB)").
- **Imperative mood for instructions.** Start steps with a verb: "Click Run", not "You should click Run."

## Formatting

- Use ATX headings (`#`, `##`, `###`). One `#` per document.
- Use fenced code blocks with a language tag: ` ```javascript ` or ` ```bash `.
- Use tables for structured comparisons.
- Use `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]` GitHub-style alerts sparingly.

## Language

All documentation in `docs/` is written in English.
Exceptions: `README-ja.md` (Japanese README) and the `TRANSLATIONS.ja` values in `js/i18n.js` (UI strings).

## Code References

When referencing source code, use the format `filename:functionName` or `filename L<n>–L<n>` (line range).
Prefer referencing stable identifiers (function names, variable names) over line numbers where possible.
