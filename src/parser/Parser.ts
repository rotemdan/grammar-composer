import { isNumber } from '../utilities/Utilities.js'
import { Grammar, GrammarNode, Terminal, type Nonterminal } from './Grammar.js'
import { type FailedMatch, ParseError } from './ParseError.js'

//////////////////////////////////////////////////////////////////////////////////////////////
// Main parser function
//////////////////////////////////////////////////////////////////////////////////////////////
export function parse(inputString: string, grammar: Grammar<any>, options?: ParserOptions) {
	options = { ...options }

	const inputLength = inputString.length

	const nonterminalStack: Nonterminal[] = []

	let bestFailedMatches: FailedMatch[] = []
	let bestFailedMatchesOffset = -1

	const cacheKeyOffsetMultiplier = grammar.maxCacheId > 0 ? grammar.maxCacheId + 1 : 1
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

	function tryParse(grammarNode: GrammarNode, startOffset: number): ParseResult | null {
		if (isNumber(grammarNode.cacheId)) {
			return tryParseCached(grammarNode, startOffset)
		} else {
			return tryParseUncached(grammarNode, startOffset)
		}
	}

	function tryParseCached(grammarNode: GrammarNode, startOffset: number): ParseResult | null {
		const cacheId = grammarNode.cacheId!
		const cacheKey = (startOffset * cacheKeyOffsetMultiplier) + cacheId

		if (parseResultsCache.has(cacheKey)) {
			return parseResultsCache.get(cacheKey)!
		} else {
			const parseResult = tryParseUncached(grammarNode, startOffset)

			parseResultsCache.set(cacheKey, parseResult)

			return parseResult
		}
	}

	function tryParseUncached(grammarNode: GrammarNode, startOffset: number): ParseResult | null {
		const result = tryParseNode(grammarNode, startOffset)

		if (result === null && grammarNode.optional === true) {
			// An optional node that doesn't match is "skipped": it succeeds
			// by consuming no input and producing no nodes. This uniformly
			// implements the `possibly()` "or skip" semantics wherever the
			// node appears (sequence members, repetition content, choice
			// members, or as the content of a production itself).
			return { endOffset: startOffset, nodes: undefined, skipped: true }
		}

		return result
	}

	function tryParseNode(grammarNode: GrammarNode, startOffset: number): ParseResult | null {
		switch (grammarNode.type) {
			case 'StringTerminal': {
				const target = grammarNode.content
				const endOffset = startOffset + target.length

				if (endOffset > inputLength) {
					updateBestFailedMatchesIfNeeded(grammarNode, startOffset)

					return null
				}

				const substringToMatch = inputString.substring(startOffset, endOffset)

				if (substringToMatch === target) {
					return {
						endOffset,
						nodes: undefined
					}
				} else {
					updateBestFailedMatchesIfNeeded(grammarNode, startOffset)

					return null
				}
			}

			case 'PatternTerminal': {
				const substringToMatch = inputString.substring(startOffset)

				const matchResults = grammarNode.regExp.exec(substringToMatch)

				if (matchResults === null) {
					updateBestFailedMatchesIfNeeded(grammarNode, startOffset)

					return null
				}

				const matchStartOffset = startOffset + matchResults.index
				const matchEndOffset = matchStartOffset + matchResults[0].length

				let nodes: ParseTreeNode[] | undefined = undefined

				const groupsIndices = matchResults.indices

				if (groupsIndices !== undefined) {
					const children: ParseTreeNode[] = []

					// Build a reverse lookup from indices entry -> group name by identity.
					// This is robust even when some groups do not participate (undefined)
					// and avoids relying on Object.keys order aligning with numeric indices.
					let indexToName: (string | undefined)[] | undefined = undefined

					if (groupsIndices.groups) {
						indexToName = new Array(groupsIndices.length)

						for (const [name, range] of Object.entries(groupsIndices.groups)) {
							if (range === undefined) {
								continue
							}

							// `range` is the same array instance as groupsIndices[index]
							const index = groupsIndices.indexOf(range)

							if (index >= 0) {
								indexToName[index] = name
							}
						}

						// Mark which indices actually correspond to named groups
						// (validatePatternCaptureGroups guarantees all-or-nothing, but be defensive)
					}

					for (let i = 1; i < (groupsIndices as unknown as number[][]).length; i++) {
						const groupIndices = (groupsIndices as unknown as (number[] | undefined)[])[i]

						if (groupIndices === undefined) {
							continue
						}

						const groupStartOffset = startOffset + groupIndices[0]
						const groupEndOffset = startOffset + groupIndices[1]

						const name = indexToName?.[i] ?? i.toString()

						children.push({
							name,
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
				nonterminalStack.push(grammarNode)

				const result = tryParse(grammarNode.content, startOffset)

				nonterminalStack.pop()

				if (result === null) {
					return null
				}

				if (result.skipped === true) {
					// The content was skipped (it was optional and didn't match),
					// so no node should be created for this nonterminal either,
					// and the skip is propagated to the parent.
					return { endOffset: startOffset, nodes: undefined, skipped: true }
				}

				const grammarNodeName = grammarNode.name

				if (grammarNode.unfolded) {
					const newResult: ParseResult = {
						endOffset: result.endOffset,
						nodes: result.nodes
					}

					return newResult
				} else {
					const newNode: ParseTreeNode = {
						name: grammarNodeName,

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

				for (const node of grammarNode.members) {
					const parseResult = tryParse(node, readOffset)

					if (parseResult !== null) {
						successfulResults.push(parseResult)

						readOffset = parseResult.endOffset
					} else if (node.optional === false) {
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
					const result = tryParse(grammarNode.content, readOffset)

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
				} else if (grammarNode.optional === true) {
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

				for (const member of grammarNode.members) {
					const result = tryParse(member, startOffset)

					if (result !== null && (bestResult === null || result.endOffset > bestResult.endOffset)) {
						bestResult = result

						if (grammarNode.exhaustive === false) {
							break
						}
					}
				}

				return bestResult
			}

			default: {
				throw new Error(`Unrecognized grammar node type '${(grammarNode as any).type}'.`)
			}
		}
	}

	const result = tryParse(grammar.rootNode, 0)

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

	// Marks a result produced by an optional node that was "skipped" (it
	// didn't match, so the parse succeeded by consuming no input and producing
	// no nodes). Set internally by the parser; a receiving `Nonterminal` uses
	// it to avoid creating a node for skipped content.
	skipped?: boolean
}

export interface ParseTreeNode {
	name: string

	startOffset: number
	endOffset: number

	sourceText: string

	children?: ParseTreeNode[]
}

export interface ParserOptions {
}
