import type { Node } from "web-tree-sitter";
import { getCppParser } from "./parser";

type SyntaxToken = {
	end: number;
	start: number;
	text: string;
	type: "preprocessor" | "token";
};

const ATOMIC_NODES = new Set([
	"char_literal",
	"concatenated_string",
	"raw_string_literal",
	"string_literal",
]);
const PUNCTUATORS = [
	"%:%:",
	">>=",
	"<<=",
	"<=>",
	"->*",
	"...",
	"##",
	"::",
	"->",
	"++",
	"--",
	"<<",
	">>",
	"<=",
	">=",
	"==",
	"!=",
	"&&",
	"||",
	"+=",
	"-=",
	"*=",
	"/=",
	"%=",
	"&=",
	"|=",
	"^=",
	".*",
	"<:",
	":>",
	"<%",
	"%>",
	"%:",
];
const separatorCache = new Map<string, boolean>();

function collectSyntaxTokens(node: Node, tokens: SyntaxToken[]): void {
	if (node.type === "comment") {
		return;
	}

	if (node.type.startsWith("preproc_")) {
		tokens.push({
			end: node.endIndex,
			start: node.startIndex,
			text: node.text,
			type: "preprocessor",
		});
		return;
	}

	if (node.childCount === 0 || ATOMIC_NODES.has(node.type)) {
		if (node.text.length > 0) {
			tokens.push({
				end: node.endIndex,
				start: node.startIndex,
				text: node.text,
				type: "token",
			});
		}
		return;
	}

	for (const child of node.children) {
		collectSyntaxTokens(child, tokens);
	}
}

function mergesPunctuator(previous: string, next: string): boolean {
	for (const punctuator of PUNCTUATORS) {
		for (let split = 1; split < punctuator.length; split++) {
			if (
				previous.endsWith(punctuator.slice(0, split)) &&
				next.startsWith(punctuator.slice(split))
			) {
				return true;
			}
		}
	}
	return false;
}

function needsSeparator(previous: SyntaxToken, next: SyntaxToken): boolean {
	const key = `${previous.text}\u0000${next.text}`;
	const cached = separatorCache.get(key);
	if (cached !== undefined) {
		return cached;
	}

	const previousEnd = previous.text.at(-1) ?? "";
	const nextStart = next.text.at(0) ?? "";
	const joinsIdentifiers =
		/[A-Za-z0-9_$\u0080-\uffff]/.test(previousEnd) &&
		/[A-Za-z0-9_$\u0080-\uffff]/.test(nextStart);
	const joinsLiteralPrefix =
		/[\w$\u0080-\uffff]$/.test(previous.text) &&
		(nextStart === '"' || nextStart === "'");
	const endsWithLiteral = /["']$/.test(previous.text);
	const nextStartsIdentifier = /^[A-Za-z_$]/.test(next.text);
	const needsSpace =
		joinsIdentifiers ||
		joinsLiteralPrefix ||
		(endsWithLiteral && nextStartsIdentifier) ||
		mergesPunctuator(previous.text, next.text) ||
		(previousEnd === "/" && (nextStart === "/" || nextStart === "*")) ||
		(previousEnd === "." && /[0-9]/.test(nextStart)) ||
		(/[0-9]/.test(previousEnd) && nextStart === ".");

	separatorCache.set(key, needsSpace);
	return needsSpace;
}

export async function minifyCpp(
	source: string,
	resourceDirectory?: string,
): Promise<string> {
	const parser = await getCppParser(resourceDirectory);
	parser.reset();
	const tree = parser.parse(source);
	if (!tree) {
		return source;
	}

	const tokens: SyntaxToken[] = [];
	collectSyntaxTokens(tree.rootNode, tokens);
	tree.delete();

	let result = "";
	let previous: SyntaxToken | undefined;

	const appendNewline = () => {
		if (result.length > 0 && !result.endsWith("\n")) {
			result += "\n";
		}
	};

	for (const token of tokens) {
		if (token.type === "preprocessor") {
			appendNewline();
			result += token.text;
			appendNewline();
			previous = undefined;
			continue;
		}

		const separated = previous !== undefined && token.start > previous.end;
		if (previous && separated && needsSeparator(previous, token)) {
			result += " ";
		}
		result += token.text;
		previous = token;
	}

	return result.endsWith("\n") ? result.slice(0, -1) : result;
}
