import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
	bumpBranchName,
	nextVersion,
	parseBumpArgs,
	releaseDate,
	replacePackageVersion,
	USAGE,
	updateChangelog,
} from "./release/versioning";

const root = path.resolve(import.meta.dir, "..");
const packagePath = path.join(root, "package.json");
const changelogPath = path.join(root, "CHANGELOG.md");

function git(args: readonly string[]): string {
	return execFileSync("git", args, {
		cwd: root,
		encoding: "utf8",
		stdio: "pipe",
	}).trim();
}

function gitI(args: readonly string[]): void {
	execFileSync("git", args, { cwd: root, stdio: "inherit" });
}

function fail(message: string): never {
	console.error(`[bump] ${message}`);
	process.exit(1);
}

const options = parseBumpArgs(process.argv.slice(2));
if (!options) {
	console.log(USAGE);
	process.exit(0);
}

if (!options.force) {
	const status = git(["status", "--porcelain"]);
	if (status.length > 0) {
		fail(
			"Working tree is not clean. Commit or stash changes, or pass --force.",
		);
	}
}

const packageJson = readFileSync(packagePath, "utf8");
const packageMetadata = JSON.parse(packageJson) as { version?: string };
if (!packageMetadata.version) {
	fail("package.json does not contain a version.");
}

const currentVersion = packageMetadata.version;
const version = nextVersion(currentVersion, options);
const branch = bumpBranchName(version);
const date = releaseDate();
const packageContent = replacePackageVersion(packageJson, version);
const changelog = readFileSync(changelogPath, "utf8");
const changelogContent = updateChangelog(changelog, version, date);

console.log(`[bump] ${currentVersion} -> ${version}`);
console.log(`[bump] Branch: ${branch}`);
if (options.preRelease) {
	console.log(`[bump] Prerelease identifier: ${options.preid}`);
}

if (options.dryRun) {
	console.log("[bump] Dry run only; no files were changed.");
	process.exit(0);
}

git(["check-ref-format", "--branch", branch]);
gitI(["switch", "-c", branch]);

writeFileSync(packagePath, packageContent);
writeFileSync(changelogPath, changelogContent);
console.log("[bump] Updated package.json and CHANGELOG.md.");

if (options.commit) {
	gitI(["add", "--", "package.json", "CHANGELOG.md"]);
	gitI(["commit", "-m", `chore(release): v${version}`]);
	console.log(`[bump] Committed version ${version}.`);
} else {
	console.log(`[bump] Skipped commit; changes are ready on ${branch}.`);
}
