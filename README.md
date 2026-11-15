# oj-bundle

A VS Code extension for competitive programmers. It invokes
[`oj-bundle`](https://github.com/online-judge-tools/verification-helper), performs
syntax-aware compression, and copies the submission-ready source to the clipboard.

## What It Does

- Bundles the active C++ source with `oj-bundle`.
- Removes comments and redundant whitespace without changing token boundaries.
- Uses Tree-sitter to shorten conservatively resolved local variables and parameters.
- Skips local renaming when the syntax tree has errors and falls back to whitespace
  compression.

Run `oj-bundle: Bundle and paste` from the command palette, or press
`Ctrl+Alt+S` (`Cmd+Alt+S` on macOS).

## Requirements

Install `verification-helper`:

```bash
uv tool install online-judge-verify-helper
```

or (not quite recommended) via pip:

```bash
pip3 install online-judge-verify-helper
```

## Extension Settings

- `oj-bundle.args`: Additional arguments passed to `oj-bundle`.
- `oj-bundle.executable`: Executable path for `oj-bundle`.
- `oj-bundle.shortenLocals`: Enable syntax-aware local variable shortening. Defaults
  to `true`.

> [!WARNING]
> According to [AtCoder Rules against Generative AI](https://info.atcoder.jp/entry/llm-rules-en), code obfuscation is prohibited in AtCoder contests.
>
> Therefore, if you are to compete in one of such contests, you should disable `oj-bundle.shortenLocals` in such contests.

## Rename Safety

Only variables and parameters that can be resolved inside a single function are
considered. Names are left unchanged when:

- a function contains a syntax error or another declaration with the same name;
- the symbol is a class member, namespace member, type, function, template parameter,
  or macro;
- the reference is qualified or appears in preprocessor code.

Short names are unique within the function and avoid identifiers already present in
that function.

## Development

Install [Bun](https://bun.sh/) and run:

```bash
bun install
bun run check
bun run build
```

### Version Bumps

The `bump` command creates a `bump/<version>` branch, updates `package.json`,
moves the current `[Unreleased]` CHANGELOG entries into a dated release section,
and commits both files:

```bash
bun run bump patch
bun run bump minor --pre-release
bun run bump major --dry-run
bun run bump patch --no-commit
```

`--dry-run` does not create a branch or modify files. `--no-commit` still creates
the branch and updates both files, but leaves the changes uncommitted. Run
`bun run bump --help` for all options. A clean working tree is required unless
`--force` is passed.

When a prerelease is promoted to the stable version with the same
`major.minor.patch`, notes from matching prerelease sections are carried into the
stable section and the prerelease sections are removed.

Tests do not launch Electron. The final extension is written to `dist/`.
