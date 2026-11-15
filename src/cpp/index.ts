import { minifyCpp } from "./minifier";
import { getCppQuery, parseCpp } from "./parser";
import { type RenameRecord, shortenLocals } from "./renamer";

export type TransformCppOptions = {
	resourceDirectory?: string;
	shortenLocals?: boolean;
};

export type TransformCppResult = {
	code: string;
	renames: RenameRecord[];
	warnings: string[];
};

export async function transformCpp(
	source: string,
	options: TransformCppOptions = {},
): Promise<TransformCppResult> {
	const renames: RenameRecord[] = [];
	const warnings: string[] = [];
	let transformed = source;

	if (options.shortenLocals ?? true) {
		try {
			const parsed = await parseCpp(source, options.resourceDirectory);
			try {
				if (parsed.root.hasError) {
					warnings.push(
						"Local names were not shortened because the C++ syntax tree contains errors.",
					);
				} else {
					const query = await getCppQuery(options.resourceDirectory);
					const result = shortenLocals(source, parsed.root, query);
					transformed = result.code;
					renames.push(...result.renames);
				}
			} finally {
				parsed.tree.delete();
			}
		} catch (error) {
			warnings.push(
				`Local names were not shortened: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	let code = transformed;
	try {
		code = await minifyCpp(transformed, options.resourceDirectory);
	} catch (error) {
		warnings.push(
			`C++ output was not minified: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}

	return { code, renames, warnings };
}
