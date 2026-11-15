import { describe, expect, test } from "bun:test";
import stringArgv from "string-argv";

describe("oj-bundle argument parsing", () => {
	test("preserves Windows paths and quoted arguments", () => {
		expect(
			stringArgv('-I "C:\\Program Files\\library" --flag="two words"'),
		).toEqual(["-I", "C:\\Program Files\\library", "--flag=two words"]);
	});
});
