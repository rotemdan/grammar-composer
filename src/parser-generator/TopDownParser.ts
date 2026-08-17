import { isNumber } from '../utilities/Utilities.js'
import { Grammar, GrammarElement, Terminal, type Nonterminal } from './Grammar.js'
import { type FailedMatch, ParseError } from './ParseError.js'

//////////////////////////////////////////////////////////////////////////////////////////////
// Main parser function
//////////////////////////////////////////////////////////////////////////////////////////////
export function parse(inputString: string, grammar: Grammar<any>, options?: TopDownParserOptions) {
	options = { ...options }

	const inputLength = inputString.length

	const nonterminalStack: Nonterminal[] = []

	let bestFailedMatches: FailedMatch[] = []
	let bestFailedMatchesOffset = -1

	const cacheKeyOffsetMultiplier = grammar.maxCacheId + 1
	const parseResultsCache = new Map<number, ParseResult | null>()

	function updateBestFailedMatchesIfNeeded(terminal: Terminal, startOffset: number) {
		if (startOffset >= bestFailedMatchesOffset) {
			const failedMatch: FailedMatch = {
				terminal,
				productionStack: [...nonterminalStack]
			}

			if (startOffset > bestFailedMatchesOffset) {
				bestFailedMatchesOffset = startOffset
				bestFailedMatches = [failedMatch]
			} else {
				bestFailedMatches.push(failedMatch)
			}
		}
	}

	function tryParse(grammarElement: GrammarElement, startOffset: number): ParseResult | null {
		if (isNumber(grammarElement.cacheId)) {
			return tryParseCached(grammarElement, startOffset)
		} else {
			return tryParseUncached(grammarElement, startOffset)
		}
	}

	function tryParseCached(grammarElement: GrammarElement, startOffset: number): ParseResult | null {
		const cacheId = grammarElement.cacheId!
		const cacheKey = (startOffset * cacheKeyOffsetMultiplier) + cacheId

		if (parseResultsCache.has(cacheKey)) {
			return parseResultsCache.get(cacheKey)!
		} else {
			const parseResult = tryParseUncached(grammarElement, startOffset)

			parseResultsCache.set(cacheKey, parseResult)

			return parseResult
		}
	}

	function tryParseUncached(grammarElement: GrammarElement, startOffset: number): ParseResult | null {
		switch (grammarElement.type) {
			case 'StringTerminal': {
				const target = grammarElement.content
				const endOffset = startOffset + target.length

				if (endOffset > inputLength) {
					updateBestFailedMatchesIfNeeded(grammarElement, startOffset)

					return null
				}

				const substringToMatch = inputString.substring(startOffset, endOffset)

				if (substringToMatch === target) {
					return {
						endOffset,
						nodes: undefined
					}
				} else {
					updateBestFailedMatchesIfNeeded(grammarElement, startOffset)

					return null
				}
			}

			case 'PatternTerminal': {
				const substringToMatch = inputString.substring(startOffset)

				const matchResults = grammarElement.regExp.exec(substringToMatch)

				if (matchResults === null) {
					updateBestFailedMatchesIfNeeded(grammarElement, startOffset)

					return null
				}

				const matchStartOffset = startOffset + matchResults.index
				const matchEndOffset = matchStartOffset + matchResults[0].length

				let nodes: ParseTreeNode[] | undefined = undefined

				const groupsIndices = matchResults.indices

				if (groupsIndices !== undefined) {
					let namedGroupIndicesIdentifiers: string[] | undefined = undefined

					if (groupsIndices.groups) {
						namedGroupIndicesIdentifiers = Object.keys(groupsIndices.groups)
					}

					const children: ParseTreeNode[] = []

					for (let i = 1; i < groupsIndices.length; i++) {
						const groupIndices = groupsIndices[i]

						if (groupIndices === undefined) {
							continue
						}

						const groupStartOffset = startOffset + groupIndices[0]
						const groupEndOffset = startOffset + groupIndices[1]

						children.push({
							name: namedGroupIndicesIdentifiers ? namedGroupIndicesIdentifiers[i - 1] : i.toString(),
							startOffset: groupStartOffset,
							endOffset: groupEndOffset,
							sourceText: inputString.substring(groupStartOffset, groupEndOffset),
							children: undefined
						})
					}

					nodes = children
				}

				const parseResult: ParseResult = {
					endOffset: matchEndOffset,
					nodes
				}

				return parseResult
			}

			case 'Nonterminal': {
				nonterminalStack.push(grammarElement)

				const result = tryParse(grammarElement.content, startOffset)

				nonterminalStack.pop()

				if (result === null) {
					return null
				}

				const grammarElementName = grammarElement.name

				if (grammarElement.unwrapped) {
					const newResult: ParseResult = {
						endOffset: result.endOffset,
						nodes: result.nodes
					}

					return newResult
				} else {
					const newNode: ParseTreeNode = {
						name: grammarElementName,

						startOffset,
						endOffset: result.endOffset,

						sourceText: inputString.substring(startOffset, result.endOffset),

						children: result.nodes,
					}

					const newResult: ParseResult = {
						endOffset: result.endOffset,
						nodes: [newNode]
					}

					return newResult
				}
			}

			case 'Sequence': {
				let successfulResults: ParseResult[] = []
				let readOffset = startOffset

				for (const element of grammarElement.members) {
					const elementResult = tryParse(element, readOffset)

					if (elementResult !== null) {
						successfulResults.push(elementResult)

						readOffset = elementResult.endOffset
					} else if (element.optional === false) {
						return null
					}
				}

				let nodes: ParseTreeNode[] = []

				for (const result of successfulResults) {
					if (result.nodes !== undefined) {
						nodes.push(...result.nodes)
					}
				}

				return {
					endOffset: readOffset,
					nodes: nodes.length > 0 ? nodes : undefined
				}
			}

			case 'Repetition': {
				let readOffset = startOffset

				const nodes: ParseTreeNode[] = []

				while (true) {
					const result = tryParse(grammarElement.content, readOffset)

					if (result === null) {
						break
					}

					if (result.endOffset === readOffset) {
						break
					}

					if (result.nodes !== undefined) {
						nodes.push(...result.nodes)
					}

					readOffset = result.endOffset
				}

				if (readOffset > startOffset) {
					return {
						endOffset: readOffset,
						nodes: nodes.length > 0 ? nodes : undefined
					}
				} else if (grammarElement.optional === true) {
					return {
						endOffset: startOffset,
						nodes: undefined
					}
				} else {
					return null
				}
			}

			case 'Choice': {
				let bestResult: ParseResult | null = null

				for (const member of grammarElement.members) {
					const result = tryParse(member, startOffset)

					if (result !== null && (bestResult === null || result.endOffset > bestResult.endOffset)) {
						bestResult = result

						if (grammarElement.exhaustive === false) {
							break
						}
					}
				}

				return bestResult
			}

			default: {
				throw new Error(`Unsupported grammar element type '${(grammarElement as any).type}'.`)
			}
		}
	}

	const result = tryParse(grammar.rootElement, 0)

	if (result && result.endOffset >= inputLength) {
		return result.nodes ?? []
	} else {
		const failureOffset = bestFailedMatches.length > 0 ? bestFailedMatchesOffset : (result?.endOffset ?? 0)

		if (bestFailedMatches.length > 0) {
			throw ParseError.createFailedParseError(inputString, failureOffset, bestFailedMatches)
		} else {
			const lastNode = result?.nodes?.[result.nodes.length - 1]
			const parsedLength = lastNode?.endOffset ?? result?.endOffset ?? 0

			throw ParseError.createIncompleteParseError(inputString, failureOffset, parsedLength)
		}
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Types
//////////////////////////////////////////////////////////////////////////////////////////////
export interface ParseResult {
	endOffset: number
	nodes: ParseTreeNode[] | undefined
}

export interface ParseTreeNode {
	name: string

	startOffset: number
	endOffset: number

	sourceText: string

	children?: ParseTreeNode[]
}

export interface TopDownParserOptions {
}
