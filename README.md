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
pip3 install online-judge-verify-helper
```

## Extension Settings

- `oj-bundle.args`: Additional arguments passed to `oj-bundle`.
- `oj-bundle.executable`: Executable path for `oj-bundle`.
- `oj-bundle.shortenLocals`: Enable syntax-aware local variable shortening. Defaults
  to `true`.

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

Tests do not launch Electron. The final extension is written to `dist/`.
