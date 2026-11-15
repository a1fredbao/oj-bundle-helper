export type TextEdit = {
	start: number;
	end: number;
	text: string;
};

export function applyTextEdits(
	source: string,
	edits: readonly TextEdit[],
): string {
	const sorted = [...edits].sort((left, right) => right.start - left.start);
	let result = source;

	for (const edit of sorted) {
		result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
	}

	return result;
}
