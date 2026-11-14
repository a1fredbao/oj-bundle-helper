import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Language, type Node, Parser, Query, type Tree } from "web-tree-sitter";

export type ParsedCpp = {
  root: Node;
  tree: Tree;
};

export type CppResources = {
  queryDirectory: string;
  treeSitterDirectory: string;
};

const parsers = new Map<string, Promise<Parser>>();
const languages = new Map<string, Promise<Language>>();
const queries = new Map<string, Promise<Query>>();

function findAssetDirectory(): string {
  const candidates = [
    process.env.OJ_BUNDLE_TREE_SITTER_DIR,
    __dirname,
    path.resolve(__dirname, "..", "..", "resources", "tree-sitter"),
    path.resolve(process.cwd(), "resources", "tree-sitter"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const directory = candidates.find((candidate) =>
    existsSync(path.join(candidate, "tree-sitter-cpp.wasm")),
  );

  if (!directory) {
    throw new Error(
      `Unable to locate Tree-sitter assets in: ${candidates.join(", ")}`,
    );
  }

  return directory;
}

function findQueryDirectory(): string {
  const candidates = [
    __dirname,
    path.resolve(__dirname, "..", "..", "resources", "queries"),
    path.resolve(process.cwd(), "resources", "queries"),
  ].filter((candidate) => existsSync(path.join(candidate, "cpp.locals.scm")));

  const directory = candidates[0];
  if (!directory) {
    throw new Error("Unable to locate the C++ locals query.");
  }
  return directory;
}

function resolveResources(resourceDirectory?: string): CppResources {
  if (resourceDirectory) {
    return {
      queryDirectory: path.join(resourceDirectory, "queries"),
      treeSitterDirectory: resourceDirectory,
    };
  }

  return {
    queryDirectory: findQueryDirectory(),
    treeSitterDirectory: findAssetDirectory(),
  };
}

async function loadLanguage(assetDirectory: string): Promise<Language> {
  const runtimeWasm = path.join(assetDirectory, "web-tree-sitter.wasm");
  const grammarWasm = path.join(assetDirectory, "tree-sitter-cpp.wasm");

  await Parser.init({
    locateFile: (scriptName) =>
      scriptName.endsWith(".wasm") ? runtimeWasm : scriptName,
  });

  return Language.load(grammarWasm);
}

async function createParser(assetDirectory: string): Promise<Parser> {
  const language = await getLanguage(assetDirectory);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

async function getLanguage(assetDirectory: string): Promise<Language> {
  let language = languages.get(assetDirectory);
  if (!language) {
    language = loadLanguage(assetDirectory);
    languages.set(assetDirectory, language);
  }
  return language;
}

export async function getCppParser(
  resourceDirectory?: string,
): Promise<Parser> {
  const resources = resolveResources(resourceDirectory);
  let parser = parsers.get(resources.treeSitterDirectory);
  if (!parser) {
    parser = createParser(resources.treeSitterDirectory);
    parsers.set(resources.treeSitterDirectory, parser);
  }
  return parser;
}

export async function getCppQuery(resourceDirectory?: string): Promise<Query> {
  const resources = resolveResources(resourceDirectory);
  let query = queries.get(resources.queryDirectory);
  if (!query) {
    query = (async () => {
      const source = [
        "c.locals.scm",
        "cpp.locals.scm",
        "cpp.locals.supplemental.scm",
      ]
        .map((file) =>
          readFileSync(path.join(resources.queryDirectory, file), "utf8"),
        )
        .join("\n");
      return new Query(
        await getLanguage(resources.treeSitterDirectory),
        source,
      );
    })();
    queries.set(resources.queryDirectory, query);
  }
  return query;
}

export async function parseCpp(
  source: string,
  resourceDirectory?: string,
): Promise<ParsedCpp> {
  const parser = await getCppParser(resourceDirectory);
  parser.reset();
  const tree = parser.parse(source);

  if (!tree) {
    throw new Error("Tree-sitter did not return a syntax tree.");
  }

  return {
    root: tree.rootNode,
    tree,
  };
}
