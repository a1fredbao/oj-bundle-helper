import type { Node, Query, QueryCapture } from "web-tree-sitter";
import { applyTextEdits, type TextEdit } from "./edits";

export type RenameRecord = {
  from: string;
  occurrences: number;
  to: string;
};

export type RenameResult = {
  code: string;
  renames: RenameRecord[];
};

type Definition = {
  capture: QueryCapture;
  functionRoot: Node;
  name: string;
  uses: Node[];
};

type Scope = {
  definitions: Map<string, Definition[]>;
  node: Node;
  parent?: Scope;
};

const KEYWORDS = new Set([
  "alignas",
  "alignof",
  "and",
  "and_eq",
  "asm",
  "auto",
  "bitand",
  "bitor",
  "bool",
  "break",
  "case",
  "catch",
  "char",
  "char8_t",
  "char16_t",
  "char32_t",
  "class",
  "compl",
  "concept",
  "const",
  "consteval",
  "constexpr",
  "constinit",
  "const_cast",
  "continue",
  "co_await",
  "co_return",
  "co_yield",
  "decltype",
  "default",
  "delete",
  "do",
  "double",
  "dynamic_cast",
  "else",
  "enum",
  "explicit",
  "export",
  "extern",
  "false",
  "float",
  "for",
  "friend",
  "goto",
  "if",
  "inline",
  "int",
  "long",
  "mutable",
  "namespace",
  "new",
  "noexcept",
  "not",
  "not_eq",
  "nullptr",
  "operator",
  "or",
  "or_eq",
  "private",
  "protected",
  "public",
  "register",
  "reinterpret_cast",
  "requires",
  "return",
  "short",
  "signed",
  "sizeof",
  "static",
  "static_assert",
  "static_cast",
  "struct",
  "switch",
  "template",
  "this",
  "thread_local",
  "throw",
  "true",
  "try",
  "typedef",
  "typeid",
  "typename",
  "union",
  "unsigned",
  "using",
  "virtual",
  "void",
  "volatile",
  "wchar_t",
  "while",
  "xor",
  "xor_eq",
]);

const IDENTIFIER_NODE_TYPES = [
  "field_identifier",
  "identifier",
  "namespace_identifier",
  "statement_identifier",
  "type_identifier",
];

function ancestors(node: Node): Node[] {
  const result: Node[] = [];
  for (let current = node.parent; current; current = current.parent) {
    result.push(current);
  }
  return result;
}

function hasAncestorType(
  node: Node,
  predicate: (type: string) => boolean,
): boolean {
  return ancestors(node).some((ancestor) => predicate(ancestor.type));
}

function functionRootFor(node: Node): Node | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "function_definition") {
      return current;
    }
  }
  return undefined;
}

function scopeForNode(
  node: Node,
  scopes: Map<number, Scope>,
): Scope | undefined {
  for (let current = node.parent; current; current = current.parent) {
    const scope = scopes.get(current.id);
    if (scope) {
      return scope;
    }
  }
  return undefined;
}

function isUnsafeReference(node: Node): boolean {
  return hasAncestorType(
    node,
    (type) =>
      type === "qualified_identifier" ||
      type === "template_function" ||
      type === "template_method" ||
      type.startsWith("preproc_"),
  );
}

function buildScopes(captures: readonly QueryCapture[]): Map<number, Scope> {
  const scopes = new Map<number, Scope>();

  for (const capture of captures) {
    if (capture.name !== "local.scope" || scopes.has(capture.node.id)) {
      continue;
    }
    scopes.set(capture.node.id, {
      definitions: new Map(),
      node: capture.node,
    });
  }

  for (const scope of scopes.values()) {
    scope.parent = scopeForNode(scope.node, scopes);
  }
  return scopes;
}

function collectionFor(
  definitions: Map<string, Definition[]>,
  name: string,
): Definition[] {
  let collection = definitions.get(name);
  if (!collection) {
    collection = [];
    definitions.set(name, collection);
  }
  return collection;
}

function addDefinitions(
  captures: readonly QueryCapture[],
  scopes: Map<number, Scope>,
): Definition[] {
  const definitions: Definition[] = [];
  const seen = new Set<number>();

  for (const capture of captures) {
    const isParameter = capture.name === "local.definition.parameter";
    const isVariable = capture.name === "local.definition.var";
    if ((!isParameter && !isVariable) || seen.has(capture.node.id)) {
      continue;
    }

    const functionRoot = functionRootFor(capture.node);
    if (
      !functionRoot ||
      functionRoot.hasError ||
      hasAncestorType(
        capture.node,
        (type) =>
          type.startsWith("preproc_") ||
          type === "ERROR" ||
          type === "field_declaration_list",
      )
    ) {
      continue;
    }

    const scope = scopeForNode(capture.node, scopes);
    if (!scope) {
      continue;
    }

    const definition: Definition = {
      capture,
      functionRoot,
      name: capture.node.text,
      uses: [],
    };
    seen.add(capture.node.id);
    definitions.push(definition);
    collectionFor(scope.definitions, definition.name).push(definition);
  }

  for (const scope of scopes.values()) {
    for (const collection of scope.definitions.values()) {
      collection.sort(
        (left, right) =>
          left.capture.node.startIndex - right.capture.node.startIndex,
      );
    }
  }

  return definitions;
}

function resolveReferences(
  captures: readonly QueryCapture[],
  definitions: readonly Definition[],
  scopes: Map<number, Scope>,
): void {
  const definitionStarts = new Set(
    definitions.map((definition) => definition.capture.node.startIndex),
  );

  for (const capture of captures) {
    if (capture.name !== "local.reference") {
      continue;
    }
    if (
      definitionStarts.has(capture.node.startIndex) ||
      capture.setProperties?.["reference.kind"] ||
      isUnsafeReference(capture.node)
    ) {
      continue;
    }

    const referenceRoot = functionRootFor(capture.node);
    if (!referenceRoot) {
      continue;
    }

    for (
      let scope = scopeForNode(capture.node, scopes);
      scope;
      scope = scope.parent
    ) {
      const candidates = scope.definitions.get(capture.node.text);
      if (!candidates) {
        continue;
      }

      const resolved = candidates
        .filter(
          (definition) =>
            definition.capture.node.startIndex <= capture.node.startIndex &&
            definition.functionRoot.id === referenceRoot.id,
        )
        .at(-1);

      if (resolved) {
        resolved.uses.push(capture.node);
        break;
      }
    }
  }
}

function nextName(index: number): string {
  let value = index;
  let result = "";
  do {
    result = String.fromCharCode(97 + (value % 26)) + result;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return result;
}

function uniqueKey(node: Node): string {
  return `${node.startIndex}:${node.endIndex}`;
}

export function shortenLocals(
  source: string,
  root: Node,
  query: Query,
): RenameResult {
  const captures = query.captures(root);
  const scopes = buildScopes(captures);
  const definitions = addDefinitions(captures, scopes);
  resolveReferences(captures, definitions, scopes);

  const byFunction = new Map<number, Definition[]>();
  for (const definition of definitions) {
    let collection = byFunction.get(definition.functionRoot.id);
    if (!collection) {
      collection = [];
      byFunction.set(definition.functionRoot.id, collection);
    }
    collection.push(definition);
  }

  const edits: TextEdit[] = [];
  const renames: RenameRecord[] = [];

  for (const functionDefinitions of byFunction.values()) {
    const functionRoot = functionDefinitions[0]?.functionRoot;
    if (!functionRoot || functionRoot.hasError) {
      continue;
    }

    const byName = new Map<string, Definition[]>();
    for (const definition of functionDefinitions) {
      collectionFor(byName, definition.name).push(definition);
    }

    const unavailable = new Set<string>(KEYWORDS);
    for (const node of functionRoot.descendantsOfType(IDENTIFIER_NODE_TYPES)) {
      unavailable.add(node.text);
    }

    const candidates = functionDefinitions
      .filter((definition) => byName.get(definition.name)?.length === 1)
      .sort(
        (left, right) =>
          right.name.length * (right.uses.length + 1) -
            left.name.length * (left.uses.length + 1) ||
          right.name.length - left.name.length,
      );

    let nameIndex = 0;
    for (const definition of candidates) {
      let replacement = "";
      while (!replacement) {
        const candidate = nextName(nameIndex++);
        if (!unavailable.has(candidate)) {
          replacement = candidate;
        }
      }

      if (replacement.length >= definition.name.length) {
        continue;
      }

      const uses = [...definition.uses, definition.capture.node];
      const uniqueUses = new Map(uses.map((node) => [uniqueKey(node), node]));
      if (uniqueUses.size === 0) {
        continue;
      }

      unavailable.add(replacement);
      for (const node of uniqueUses.values()) {
        edits.push({
          start: node.startIndex,
          end: node.endIndex,
          text: replacement,
        });
      }
      renames.push({
        from: definition.name,
        to: replacement,
        occurrences: uniqueUses.size,
      });
    }
  }

  return {
    code: applyTextEdits(source, edits),
    renames,
  };
}
