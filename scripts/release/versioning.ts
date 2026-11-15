import semver from "semver";

export type BumpType = "major" | "minor" | "patch";

export type BumpOptions = {
	bump: BumpType;
	commit: boolean;
	dryRun: boolean;
	force: boolean;
	preRelease: boolean;
	preid: string;
};

export const USAGE = `Usage:
	bun run bump <patch|minor|major> [options]

Options:
	--pre-release, -p	 Create a prerelease version
	--preid <name>			Prerelease identifier (default: beta)
	--dry-run, -n			 Show the planned version without writing files
	--force, -f				 Skip the clean working tree check
	--no-commit				 Create bump/<version> but skip the commit
	--help, -h					Show this help`;

function isBumpType(value: string): value is BumpType {
	return value === "major" || value === "minor" || value === "patch";
}

function optionValue(
	args: readonly string[],
	index: number,
	name: string,
): string {
	const value = args[index + 1];
	if (!value || value.startsWith("-")) {
		throw new Error(`${name} requires a value.`);
	}
	return value;
}

export function parseBumpArgs(
	args: readonly string[],
): BumpOptions | undefined {
	let bump: BumpType | undefined;
	let commit = true;
	let dryRun = false;
	let force = false;
	let preRelease = false;
	let preid = "beta";
	let preidSpecified = false;

	if (args.length === 0) {
		return undefined;
	}

	for (let index = 0; index < args.length; index++) {
		const argument = args[index];

		if (argument === "--help" || argument === "-h") {
			return undefined;
		}

		if (isBumpType(argument)) {
			if (bump) {
				throw new Error(
					`Only one bump type is allowed, received ${bump} and ${argument}.`,
				);
			}
			bump = argument;
			continue;
		}

		if (
			argument === "--pre-release" ||
			argument === "--prerelease" ||
			argument === "-p"
		) {
			preRelease = true;
			continue;
		}

		if (argument === "--dry-run" || argument === "-n") {
			dryRun = true;
			continue;
		}

		if (argument === "--force" || argument === "-f") {
			force = true;
			continue;
		}

		if (argument === "--commit" || argument === "-c") {
			commit = true;
			continue;
		}

		if (argument === "--no-commit") {
			commit = false;
			continue;
		}

		if (argument === "--preid") {
			preid = optionValue(args, index, "--preid");
			preidSpecified = true;
			index++;
			continue;
		}

		if (argument.startsWith("--preid=")) {
			preid = argument.slice("--preid=".length);
			preidSpecified = true;
			continue;
		}

		throw new Error(`Unknown argument: ${argument}`);
	}

	if (!bump) {
		throw new Error("A bump type is required: patch, minor, or major.");
	}
	if (!/^[0-9A-Za-z-]+$/.test(preid)) {
		throw new Error("--preid must contain only letters, digits, or hyphens.");
	}
	if (preidSpecified && !preRelease) {
		throw new Error("--preid requires --pre-release.");
	}
	return {
		bump,
		commit,
		dryRun,
		force,
		preRelease,
		preid,
	};
}

export function bumpBranchName(version: string): string {
	return `bump/${version}`;
}

export function nextVersion(
	currentVersion: string,
	options: Pick<BumpOptions, "bump" | "preRelease" | "preid">,
): string {
	if (!semver.valid(currentVersion)) {
		throw new Error(`Invalid current version: ${currentVersion}`);
	}

	const releaseType = options.preRelease
		? (`pre${options.bump}` as semver.ReleaseType)
		: options.bump;
	const version = options.preRelease
		? semver.inc(currentVersion, releaseType, options.preid)
		: semver.inc(currentVersion, releaseType);

	if (!version || !semver.gt(version, currentVersion)) {
		throw new Error(`Unable to increment ${currentVersion} as ${releaseType}.`);
	}
	return version;
}

export function replacePackageVersion(
	packageJson: string,
	version: string,
): string {
	const pattern = /("version"\s*:\s*")[^"]+(")/;
	if (!pattern.test(packageJson)) {
		throw new Error("Unable to find the version field in package.json.");
	}
	return packageJson.replace(pattern, `$1${version}$2`);
}

export function updateChangelog(
	changelog: string,
	version: string,
	date: string,
): string {
	const marker = "## [Unreleased]";
	const markerIndex = changelog.indexOf(marker);
	if (markerIndex === -1) {
		throw new Error(`Unable to find "${marker}" in CHANGELOG.md.`);
	}

	const markerLineEnd = changelog.indexOf("\n", markerIndex);
	const bodyStart = markerLineEnd === -1 ? changelog.length : markerLineEnd + 1;
	const headingPattern = /^## \[[^\]]+\]/gm;
	headingPattern.lastIndex = bodyStart;
	const nextHeading = headingPattern.exec(changelog);
	const bodyEnd = nextHeading?.index ?? changelog.length;
	const pending = changelog.slice(bodyStart, bodyEnd).trim();

	if (pending.length === 0) {
		throw new Error(
			"The Unreleased section is empty. Add release notes first.",
		);
	}

	const before = changelog.slice(0, markerIndex).trimEnd();
	const after = nextHeading ? changelog.slice(bodyEnd).trimStart() : "";
	const release = `## [${version}] - ${date}`;
	const sections = [before, marker, release, pending, after].filter(
		(section) => section.length > 0,
	);

	return `${sections.join("\n\n").trimEnd()}\n`;
}

export function releaseDate(date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
