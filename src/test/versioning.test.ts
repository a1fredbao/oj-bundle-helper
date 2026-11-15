import { describe, expect, test } from "bun:test";
import {
	bumpBranchName,
	nextVersion,
	parseBumpArgs,
	releaseDate,
	replacePackageVersion,
	updateChangelog,
} from "../../scripts/release/versioning";

describe("bump version", () => {
	test("parses a basic bump command", () => {
		expect(parseBumpArgs(["patch"])).toEqual({
			bump: "patch",
			commit: true,
			dryRun: false,
			force: false,
			preRelease: false,
			preid: "beta",
		});
	});

	test("parses prerelease and no-commit options", () => {
		expect(
			parseBumpArgs(["minor", "--pre-release", "--preid=rc", "--no-commit"]),
		).toEqual({
			bump: "minor",
			commit: false,
			dryRun: false,
			force: false,
			preRelease: true,
			preid: "rc",
		});
	});

	test("uses a versioned bump branch", () => {
		expect(bumpBranchName("1.1.0")).toBe("bump/1.1.0");
	});

	test("rejects preid without prerelease", () => {
		expect(() => parseBumpArgs(["patch", "--preid=rc"])).toThrow(
			"--preid requires --pre-release",
		);
	});

	test("increments stable versions", () => {
		expect(
			nextVersion("1.0.4", {
				bump: "patch",
				preRelease: false,
				preid: "beta",
			}),
		).toBe("1.0.5");
		expect(
			nextVersion("1.0.4", {
				bump: "minor",
				preRelease: false,
				preid: "beta",
			}),
		).toBe("1.1.0");
		expect(
			nextVersion("1.0.4", {
				bump: "major",
				preRelease: false,
				preid: "beta",
			}),
		).toBe("2.0.0");
	});

	test("creates prerelease versions", () => {
		expect(
			nextVersion("1.0.4", {
				bump: "patch",
				preRelease: true,
				preid: "beta",
			}),
		).toBe("1.0.5-beta.0");
	});

	test("promotes a prerelease to the requested stable version", () => {
		expect(
			nextVersion("1.0.5-beta.0", {
				bump: "patch",
				preRelease: false,
				preid: "beta",
			}),
		).toBe("1.0.5");
	});

	test("updates only the package version field", () => {
		const source = '{\n  "version": "1.0.4",\n  "name": "oj-bundle"\n}\n';
		expect(replacePackageVersion(source, "1.1.0")).toContain(
			'"version": "1.1.0"',
		);
		expect(replacePackageVersion(source, "1.1.0")).toContain(
			'"name": "oj-bundle"',
		);
	});

	test("moves Unreleased notes under the new version", () => {
		const source = `# Change Log

## [Unreleased]

- Added a feature.

## [1.0.4] - 2026-01-01

- Previous release.
`;
		const result = updateChangelog(source, "1.1.0", "2026-11-15");

		expect(result).toContain("## [Unreleased]\n\n## [1.1.0] - 2026-11-15");
		expect(result).toContain("- Added a feature.");
		expect(result).toContain("## [1.0.4] - 2026-01-01");
	});

	test("rejects an empty Unreleased section", () => {
		expect(() =>
			updateChangelog("## [Unreleased]\n\n## [1.0.4]\n", "1.0.5", "2026-11-15"),
		).toThrow("The Unreleased section is empty");
	});

	test("formats a local calendar date", () => {
		expect(releaseDate(new Date(2026, 10, 15, 23, 30))).toBe("2026-11-15");
	});
});
