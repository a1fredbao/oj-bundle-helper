import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import spawn from "cross-spawn";
import stringArgv from "string-argv";
import { window, workspace } from "vscode";

export type Run = {
  code: number | null;
  stderr: string;
  stdout: string;
};

function sourceDirectory(): string | undefined {
  const editor = window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const folder = workspace.getWorkspaceFolder(editor.document.uri);
  return folder?.uri.fsPath ?? path.dirname(editor.document.uri.fsPath);
}

async function runProcess(
  executable: string,
  args: readonly string[],
  cwd: string,
): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ code, stderr, stdout });
    });
  });
}

export async function bundle(source: string): Promise<Run> {
  const tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "oj-bundle-helper-"),
  );
  const inputFile = path.join(tempDirectory, "main.cpp");
  const directory = sourceDirectory();

  try {
    await writeFile(inputFile, source, "utf8");

    const config = workspace.getConfiguration("oj-bundle");
    const executable = config.get("executable", "oj-bundle");
    const args = stringArgv(config.get("args", ""));
    if (directory) {
      args.push("-I", directory);
    }
    args.push(inputFile);

    return await runProcess(executable, args, directory ?? tempDirectory);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
