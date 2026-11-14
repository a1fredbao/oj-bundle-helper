import path from "node:path";
import * as vscode from "vscode";
import { bundle } from "./bundle";
import { transformCpp } from "./cpp";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function bundleAndPaste(extensionPath: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  try {
    const result = await bundle(editor.document.getText());
    if (result.code !== 0) {
      throw new Error(result.stderr || `oj-bundle exited with ${result.code}`);
    }

    const shortenLocals = vscode.workspace
      .getConfiguration("oj-bundle")
      .get("shortenLocals", true);
    const transformed = await transformCpp(result.stdout, {
      resourceDirectory: path.join(extensionPath, "dist"),
      shortenLocals,
    });
    await vscode.env.clipboard.writeText(transformed.code);

    if (transformed.warnings.length > 0) {
      await vscode.window.showWarningMessage(
        `Bundle copied, but ${transformed.warnings.join(" ")}`,
      );
    } else {
      await vscode.window.showInformationMessage("Bundle copied to clipboard.");
    }
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Failed to bundle the code: ${errorMessage(error)}`,
    );
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("oj-bundle.bundle-and-paste", () =>
      bundleAndPaste(context.extensionPath),
    ),
  );
}

export function deactivate(): void {}
