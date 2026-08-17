/////////////////////////////////////////////////////////////////////////////////////////////////
// Position helpers
/////////////////////////////////////////////////////////////////////////////////////////////////
export function getLineAndColumn(input: string, offset: number): { line: number, column: number } {
	let line = 1
	let lineStartOffset = 0

	for (let i = 0; i < offset && i < input.length; i++) {
		if (input[i] === '\n') {
			line += 1
			lineStartOffset = i + 1
		}
	}

	return {
		line,
		column: offset - lineStartOffset + 1
	}
}

const tabSize = 4

export function expandTabs(text: string): string {
	let result = ''
	let column = 0

	for (const char of text) {
		if (char === '\t') {
			const spacesToNextTabStop = tabSize - (column % tabSize)

			result += ' '.repeat(spacesToNextTabStop)
			column += spacesToNextTabStop
		} else {
			result += char
			column += 1
		}
	}

	return result
}

export function buildCaretSpacing(text: string, caretColumn: number): string {
	let spacing = ''
	let column = 0

	for (let i = 0; i < caretColumn - 1 && i < text.length; i++) {
		const char = text[i]

		if (char === '\t') {
			const spacesToNextTabStop = tabSize - (column % tabSize)

			spacing += ' '.repeat(spacesToNextTabStop)
			column += spacesToNextTabStop
		} else {
			spacing += ' '
			column += 1
		}
	}

	return spacing
}
