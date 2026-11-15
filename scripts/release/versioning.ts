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

type ChangelogSection = {
	body: string;
	heading: string;
	version: string;
};

export const RELEASE_FILES = ["package.json", "CHANGELOG.md"] as const;

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

export function releaseCommitArgs(version: string): string[] {
	return [
		"commit",
		"--only",
		"-m",
		`chore(release): v${version}`,
		"--",
		...RELEASE_FILES,
	];
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

function parseChangelog(changelog: string): {
	prefix: string;
	sections: ChangelogSection[];
} {
	const headingPattern = /^## \[([^\]]+)\](?: - [^\n]+)?[ \t]*$/gm;
	const matches = [...changelog.matchAll(headingPattern)];
	if (matches.length === 0) {
		throw new Error("CHANGELOG.md does not contain any version sections.");
	}

	const prefix = changelog.slice(0, matches[0].index).trimEnd();
	const sections = matches.map((match, index) => {
		const headingEnd = (match.index ?? 0) + match[0].length;
		const bodyEnd = matches[index + 1]?.index ?? changelog.length;
		return {
			body: changelog.slice(headingEnd, bodyEnd).trim(),
			heading: match[0].trimEnd(),
			version: match[1],
		};
	});

	return { prefix, sections };
}

function renderChangelog(
	prefix: string,
	sections: readonly ChangelogSection[],
): string {
	const blocks = [
		prefix.trim(),
		...sections.map((section) =>
			section.body.length > 0
				? `${section.heading}\n\n${section.body}`
				: section.heading,
		),
	].filter((block) => block.length > 0);

	return `${blocks.join("\n\n").trimEnd()}\n`;
}

function isPrereleasePromotion(
	currentVersion: string | undefined,
	nextVersionValue: string,
): boolean {
	if (!currentVersion) {
		return false;
	}

	const current = semver.parse(currentVersion);
	const next = semver.parse(nextVersionValue);
	return Boolean(
		current &&
			next &&
			current.prerelease.length > 0 &&
			next.prerelease.length === 0 &&
			current.major === next.major &&
			current.minor === next.minor &&
			current.patch === next.patch,
	);
}

function isMatchingPrerelease(
	sectionVersion: string,
	stableVersion: string,
): boolean {
	const prerelease = semver.parse(sectionVersion);
	const stable = semver.parse(stableVersion);
	return Boolean(
		prerelease &&
			stable &&
			prerelease.prerelease.length > 0 &&
			prerelease.major === stable.major &&
			prerelease.minor === stable.minor &&
			prerelease.patch === stable.patch,
	);
}

export function updateChangelog(
	changelog: string,
	version: string,
	date: string,
	currentVersion?: string,
): string {
	const { prefix, sections } = parseChangelog(changelog);
	const unreleasedIndex = sections.findIndex(
		(section) => section.version === "Unreleased",
	);
	if (unreleasedIndex === -1) {
		throw new Error('Unable to find "## [Unreleased]" in CHANGELOG.md.');
	}

	const unreleased = sections[unreleasedIndex];
	const promotedSections = isPrereleasePromotion(currentVersion, version)
		? sections.filter((section) =>
				isMatchingPrerelease(section.version, version),
			)
		: [];
	const releaseNotes = [
		unreleased.body,
		...promotedSections.map((section) => section.body),
	]
		.filter((body) => body.length > 0)
		.join("\n\n");

	if (releaseNotes.length === 0) {
		throw new Error(
			"The Unreleased section is empty and no prerelease notes are available.",
		);
	}

	const promotedVersions = new Set(
		promotedSections.map((section) => section.version),
	);
	const remainingSections = sections.filter(
		(section, index) =>
			index !== unreleasedIndex && !promotedVersions.has(section.version),
	);

	return renderChangelog(prefix, [
		{ body: "", heading: "## [Unreleased]", version: "Unreleased" },
		{
			body: releaseNotes,
			heading: `## [${version}] - ${date}`,
			version,
		},
		...remainingSections,
	]);
}

export function releaseDate(date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
