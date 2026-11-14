# Change Log

All notable changes to the "oj-bundle" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Replaced the legacy whitespace scanner with syntax-aware C++ compression.
- Fixed template parameter boundaries such as `int> = 0`.
- Added conservative scope-based local variable shortening.
- Added fallback behavior for syntax errors and unreadable grammar assets.
- Migrated the development workflow from npm/ESLint to Bun/Biome.
- Added cross-platform Bun CI, build verification, and Dependabot configuration.
