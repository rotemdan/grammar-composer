import type { Nonterminal, Terminal } from './Grammar.js'
import { buildCaretSpacing, expandTabs, getLineAndColumn } from '../utilities/LineAndColumn.js'
import { escapeChar, TerminalToText } from './TerminalToText.js'

/////////////////////////////////////////////////////////////////////////////////////////////////
// Parse error class
/////////////////////////////////////////////////////////////////////////////////////////////////
export class ParseError extends Error {
	readonly input: string

	readonly offset: number
	readonly line: number
	readonly column: number

	readonly found?: string
	readonly expected?: readonly ExpectedTerminal[]

	readonly contextProduction?: string

	constructor(details: ParseErrorDetails, maxDisplayedLineLength = 100) {
		const { line, column } = getLineAndColumn(details.input, details.offset)

		const errorMessage = buildErrorMessage(details, line, column, maxDisplayedLineLength)

		super(errorMessage)

		this.name = 'ParseError'

		this.input = details.input

		this.offset = details.offset
		this.line = line
		this.column = column


		if (details.offset < details.input.length) {
			this.found = details.input[details.offset]
		}
		this.expected = details.expected

		this.contextProduction = details.contextProductionName
	}

	// Dedicated factory for the case where parsing failed because no expected
	// terminal matched at some position.
	static createFailedParseError(input: string, offset: number, bestFailedMatches: FailedMatch[]): ParseError {
		const { expected, contextProduction } = analyzeFailedMatches(bestFailedMatches)

		return new ParseError({
			input,
			offset,
			expected,
			contextProductionName: contextProduction.name
		})
	}

	// Dedicated factory for the case where parsing consumed only part of the input
	// without any specific terminal failing.
	static createIncompleteParseError(input: string, offset: number, parsedLength: number): ParseError {
		return new ParseError({ input, offset, parsedLength })
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Failed match analysis
/////////////////////////////////////////////////////////////////////////////////////////////////

// Computes the data needed to describe a parse failure: the deduplicated list of expected
// terminals (each retaining the production it belongs to) and the shared context production.
// The actual message formatting is owned by ParseError.
export function analyzeFailedMatches(failedMatches: FailedMatch[]): FailedMatchAnalysisResult {
	const productionStacks = failedMatches.map(failedMatch => failedMatch.productionStack)

	const commonProductionPrefix = findCommonProductionPrefix(productionStacks)
	const contextProduction = commonProductionPrefix[commonProductionPrefix.length - 1]

	// Collect every production each distinct terminal could be part of, together with
	// the production stack that led to it. The production is the one directly below
	// the shared context production.
	const candidatesByTerminal = new Map<string, TerminalCandidate[]>()

	for (const failedMatch of failedMatches) {
		const subProduction = failedMatch.productionStack[commonProductionPrefix.length] ?? contextProduction

		if (subProduction === undefined) {
			continue
		}

		const stringifiedFailedTerminal = stringifyFailedTerminal(failedMatch)

		const candidates = candidatesByTerminal.get(stringifiedFailedTerminal) ?? []

		candidates.push({ production: subProduction, productionStack: failedMatch.productionStack })
		candidatesByTerminal.set(stringifiedFailedTerminal, candidates)
	}

	// When the same terminal can be reached through several productions and one of
	// them is an ancestor of another (e.g. the same pattern is referenced both
	// directly and through a parent production), keep only the innermost production.
	const expected: ExpectedTerminal[] = []

	for (const [stringifiedFailedTerminal, candidates] of candidatesByTerminal) {
		for (const candidate of candidates) {
			if (isRedundantCandidate(candidate, candidates)) {
				continue
			}

			if (!expected.some(entry =>
				entry.productionName === candidate.production.name && entry.terminalString === stringifiedFailedTerminal)) {

				expected.push({ productionName: candidate.production.name, terminalString: stringifiedFailedTerminal })
			}
		}
	}

	return {
		expected,
		contextProduction,
	}
}

// A candidate is redundant when the same terminal is also expected by a deeper
// production within the same context, i.e. when another candidate's production
// appears below this candidate's production in its own stack.
//
// Compare within the other candidate's own stack: if there exists another
// candidate `other` such that `candidate` is an ancestor of `other` in
// `other`'s stack, keep only `other` (innermost).
function isRedundantCandidate(candidate: TerminalCandidate, candidates: TerminalCandidate[]): boolean {
	for (const other of candidates) {
		if (other === candidate) {
			continue
		}

		const candidateIndexInOther = stackIndexOf(other.productionStack, candidate.production)

		const otherIndexInOther = stackIndexOf(other.productionStack, other.production)

		if (candidateIndexInOther !== -1 && otherIndexInOther !== -1 && otherIndexInOther > candidateIndexInOther) {
			return true
		}
	}
	return false
}

// Compares nonterminals by their canonical grammar reference, because the same
// production can be represented by multiple cloned instances during a parse.
function stackIndexOf(productionStack: Nonterminal[], production: Nonterminal): number {
	const canonical = production.grammarNonterminal ?? production

	return productionStack.findIndex(nonterminal => (nonterminal.grammarNonterminal ?? nonterminal) === canonical)
}

function areTerminalsEqual(a: any, b: any): boolean {
	if (a === b) {
		return true
	}

	if (a?.type !== b?.type) {
		return false
	}

	if (a.type === 'StringTerminal') {
		return a.content === b.content
	}

	if (a.type === 'PatternTerminal') {
		return a.regExp.source === b.regExp.source && a.regExp.flags === b.regExp.flags
	}

	return false
}

function stringifyFailedTerminal(failedMatch: FailedMatch): string {
	const { terminal, productionStack } = failedMatch

	if (terminal.name !== undefined) {
		return terminal.name
	}

	// Compare terminals by structural identity: PatternTerminals are
	// reconstructed objects, StringTerminals are cloned, so object
	// identity vs innermostProduction.content is not reliable.
	//
	// Instead check if the failed terminal equals the content of any
	// production in the stack by value.
	for (let i = productionStack.length - 1; i >= 0; i--) {
		const production = productionStack[i]

		if (areTerminalsEqual(production.content, terminal)) {
			return production.name
		}
	}

	const stringifiedLengthLimit = 100
	const terminalToText = new TerminalToText(stringifiedLengthLimit)

	return terminalToText.stringifyTerminal(terminal)
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Production grouping
/////////////////////////////////////////////////////////////////////////////////////////////////

// The stacks are compared by canonical nonterminal identity rather than object identity,
// because the same production can be represented by multiple distinct object instances
// during a single parse: the grammar builder creates spread copies of the canonical
// nonterminal for optional references and for references wrapped in cached(). Each clone
// keeps a reference to the original in 'grammarNonterminal'.
function findCommonProductionPrefix(productionStacks: Nonterminal[][]): Nonterminal[] {
	if (productionStacks.length === 0) {
		return []
	}

	let commonPrefix = productionStacks[0]

	for (let i = 1; i < productionStacks.length; i++) {
		const stack = productionStacks[i]
		let commonLength = 0

		while (commonLength < commonPrefix.length &&
			commonLength < stack.length &&
			areSameNonterminal(commonPrefix[commonLength], stack[commonLength])) {

			commonLength += 1
		}

		commonPrefix = commonPrefix.slice(0, commonLength)

		if (commonPrefix.length === 0) {
			break
		}
	}

	return commonPrefix
}

function areSameNonterminal(a: Nonterminal, b: Nonterminal): boolean {
	return (a.grammarNonterminal ?? a) === (b.grammarNonterminal ?? b)
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Parse error helpers
/////////////////////////////////////////////////////////////////////////////////////////////////
function buildErrorMessage(details: ParseErrorDetails, line: number, column: number, maxDisplayedLineLength: number): string {
	const context = formatErrorContext(details.input, details.offset, maxDisplayedLineLength)

	if (details.parsedLength !== undefined) {
		return `Failed parsing the input text ${context}\n\n` +
			`Stopped parsing at line ${line}, column ${column} (${details.parsedLength} of ${details.input.length} characters consumed).`
	}

	const expected = details.expected ?? []
	const expectedMessage = expected.length > 0
		? buildExpectedGroupsMessage(expected)
		: ''

	const contextMessage = details.contextProductionName !== undefined
		? `While parsing '${details.contextProductionName}', expected one of the following:\n\n${expectedMessage}`
		: `Expected one of the following:\n\n${expectedMessage}`

	return `Failed parsing the input text ${context}\n\n${contextMessage}`
}

// Formats the expected terminals grouped by production, with a blank line between
// the groups so the message stays readable.
function buildExpectedGroupsMessage(expected: readonly ExpectedTerminal[]): string {
	const expectedByProduction = new Map<string, string[]>()

	for (const { productionName, terminalString } of expected) {
		const stringifiedTerminals = expectedByProduction.get(productionName) ?? []

		if (!stringifiedTerminals.includes(terminalString)) {
			stringifiedTerminals.push(terminalString)
		}

		expectedByProduction.set(productionName, stringifiedTerminals)
	}

	return [...expectedByProduction.entries()]
		.map(([productionName, stringifiedTerminals]) => `In '${productionName}': ${stringifiedTerminals.join(', ')}`)
		.join('\n\n')
}

function formatErrorContext(input: string, offset: number, maxDisplayedLineLength: number): string {
	const { line, column } = getLineAndColumn(input, offset)

	let lineStartOffset = offset
	while (lineStartOffset > 0 && input[lineStartOffset - 1] !== '\n') {
		lineStartOffset -= 1
	}

	let lineEndOffset = offset
	while (lineEndOffset < input.length && input[lineEndOffset] !== '\n') {
		lineEndOffset += 1
	}

	const lineText = input.substring(lineStartOffset, lineEndOffset).replace(/\r$/, '')

	let displayedText = lineText
	let displayedCaretColumn = column

	// If the failing line is very long (e.g. minified input), show a window around the
	// error position instead of the entire line.
	if (lineText.length > maxDisplayedLineLength) {
		const rawCaretOffset = Math.min(column - 1, lineText.length)
		const radius = Math.floor(maxDisplayedLineLength / 2)

		const contextStart = Math.max(0, rawCaretOffset - radius)
		const contextEnd = Math.min(lineText.length, rawCaretOffset + radius)

		const hasTruncatedStart = contextStart > 0
		const hasTruncatedEnd = contextEnd < lineText.length

		const truncatedLine = lineText.substring(contextStart, contextEnd)

		displayedText = `${hasTruncatedStart ? '…' : ''}${truncatedLine}${hasTruncatedEnd ? '…' : ''}`
		displayedCaretColumn = (rawCaretOffset - contextStart) + (hasTruncatedStart ? 1 : 0) + 1
	}

	let unexpectedTargetText: string

	if (offset < input.length) {
		const targetChar = input[offset]
		const escapedTargetChar = escapeChar(targetChar)

		unexpectedTargetText = ` (unexpected character '${escapedTargetChar}')`
	} else {
		unexpectedTargetText = ' (unexpected end of input)'
	}

	const text = `at line ${line}, column ${column}${unexpectedTargetText}:\n\n\t${expandTabs(displayedText)}\n\t${buildCaretSpacing(displayedText, displayedCaretColumn)}^`

	return text
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Types
/////////////////////////////////////////////////////////////////////////////////////////////////
interface TerminalCandidate {
	production: Nonterminal
	productionStack: Nonterminal[]
}

interface FailedMatchAnalysisResult {
	expected: ExpectedTerminal[]
	contextProduction: Nonterminal
}

export interface FailedMatch {
	terminal: Terminal
	productionStack: Nonterminal[]
}

// A single expected terminal, retaining the production it belongs to.
export interface ExpectedTerminal {
	productionName: string
	terminalString: string
}

export interface ParseErrorDetails {
	input: string
	offset: number

	expected?: readonly ExpectedTerminal[]
	contextProductionName?: string
	parsedLength?: number
}
