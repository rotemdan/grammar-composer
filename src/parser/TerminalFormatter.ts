import type { Pattern, SpecialToken } from 'regexp-composer'
import type { PatternTerminal, StringTerminal, Terminal } from './Grammar.js'

/////////////////////////////////////////////////////////////////////////////////////////////////
// Terminal to text conversion
/////////////////////////////////////////////////////////////////////////////////////////////////
export class TerminalFormatter {
	constructor(private stringifiedLengthLimit: number) {
	}

	stringifyTerminal(terminal: Terminal): string {
		if (terminal.type === 'StringTerminal') {
			return this.stringifyStringTerminal(terminal)
		} else {
			return this.stringifyPatternTerminal(terminal)
		}
	}

	stringifyStringTerminal(terminal: StringTerminal): string {
		return this.stringifyPatternStringLiteral(terminal.content)
	}

	stringifyPatternTerminal(terminal: PatternTerminal) {
		let pattern = terminal.pattern

		// Pattern terminals are automatically anchored at the start of the current parse
		// position. This anchor is an implementation detail, so remove it.
		if (Array.isArray(pattern) && pattern.length > 1) {
			const firstElement = pattern[0]

			if (!Array.isArray(firstElement) && typeof firstElement !== 'string' &&
				firstElement.type === 'specialToken' && firstElement.name === 'inputStart') {

				pattern = pattern.slice(1)
			}
		}

		const stringifiedPattern = this.stringifyPattern(pattern)
		const truncatedStringifiedPattern = this.truncateString(stringifiedPattern, this.stringifiedLengthLimit)

		return truncatedStringifiedPattern
	}

	stringifyPattern(pattern: Pattern): string {
		if (typeof pattern === 'string') {
			return this.stringifyPatternStringLiteral(pattern)
		}

		if (Array.isArray(pattern)) {
			return `[${pattern.map((pattern) => this.stringifyPattern(pattern)).join(', ')}]`
		}

		switch (pattern.type) {
			case 'specialToken': {
				return this.stringifySpecialToken(pattern)
			}

			case 'possibly': {
				return `possibly(${this.stringifyPattern(pattern.content)})`
			}

			case 'zeroOrMore': {
				return `zeroOrMore(${this.stringifyPattern(pattern.content)})`
			}

			case 'oneOrMore': {
				return `oneOrMore(${this.stringifyPattern(pattern.content)})`
			}

			case 'repeated': {
				const { minCount, maxCount } = pattern
				const stringifiedContent = this.stringifyPattern(pattern.content)

				if (minCount === maxCount) {
					return `repeated(${minCount}, ${stringifiedContent})`
				} else if (maxCount === Number.POSITIVE_INFINITY) {
					return `repeated([${minCount}, ...], ${stringifiedContent})`
				} else {
					return `repeated([${minCount}, ${maxCount}], ${stringifiedContent})`
				}
			}

			case 'capture': {
				if (pattern.name !== undefined) {
					return pattern.name
				}

				return `(${this.stringifyPattern(pattern.content)})`
			}

			case 'anyOf': {
				const stringifiedMembers = pattern.members.map((pattern) => this.stringifyPattern(pattern))

				let stringified = `anyOf(${stringifiedMembers.join(', ')})`

				if (stringified.length > this.stringifiedLengthLimit && stringifiedMembers.length > 2) {
					stringified = `anyOf(${stringifiedMembers[0]}, ${stringifiedMembers[1]}, …, ${stringifiedMembers[stringifiedMembers.length - 1]})`
				}

				return stringified
			}

			case 'notAnyOfChars': {
				const stringifiedMembers = pattern.members.map((pattern) => this.stringifyPattern(pattern))

				return `notAnyOfChars(${stringifiedMembers.join(', ')})`
			}

			case 'followedBy': {
				return `followedBy(${this.stringifyPattern(pattern.content)})`
			}

			case 'notFollowedBy': {
				return `notFollowedBy(${this.stringifyPattern(pattern.content)})`
			}

			case 'precededBy': {
				return `precededBy(${this.stringifyPattern(pattern.content)})`
			}

			case 'notPrecededBy': {
				return `notPrecededBy(${this.stringifyPattern(pattern.content)})`
			}

			case 'sameAs': {
				const captureGroupNameOrIndex = pattern.captureGroupNameOrIndex

				if (typeof captureGroupNameOrIndex === 'string') {
					return `sameAs('${captureGroupNameOrIndex}')`
				} else {
					return `sameAs(${captureGroupNameOrIndex})`
				}
			}

			default: {
				throw new Error(`Unrecognized pattern type: ${(pattern as any).type}.`)
			}
		}
	}

	stringifyPatternStringLiteral(text: string): string {
		let result = ''

		for (const char of text) {
			const escapedChar = escapeChar(char)

			result += escapedChar
		}

		return `'${result}'`
	}

	stringifySpecialToken(token: SpecialToken): string {
		if (token.name === 'charRange') {
			const dashIndex = token.rawRegExp.indexOf('-')

			if (dashIndex > 0 && dashIndex < token.rawRegExp.length - 1) {
				const startChar = token.rawRegExp.substring(0, dashIndex).replace(/^\\/, '')

				if (startChar.length > 0) {
					return `charRange('${startChar}', '${token.rawRegExp.substring(dashIndex + 1)}')`
				}
			}
		} else if (token.name !== undefined) {
			return token.name
		}

		return token.rawRegExp
	}

	truncateString(str: string, lengthLimit: number): string {
		if (str.length <= lengthLimit) {
			return str
		}

		return `${str.substring(0, lengthLimit - 1)}…`
	}
}

export function escapeChar(char: string): string {
	const charMapping: Record<string, string> = {
		'\\': '\\\\',
		"'": "\\'",
		'\n': '\\n',
		'\r': '\\r',
		'\t': '\\t',
	}

	const mappedChar = charMapping[char]

	if (mappedChar !== undefined) {
		return mappedChar
	} else {
		return char
	}
}
