import { Grammar, GrammarElement, Terminal } from "./GrammarComposer.js"

export function parse(inputString: string, grammar: Grammar<any>) {
	const inputLength = inputString.length
	const maxElementId = grammar.maxElementId

	let bestFailedMatches: Terminal[] = []
	let bestFailedMatchesOffset = -1

	function updateBestFailedMatchesIfNeeded(terminal: Terminal, startOffset: number) {
		if (startOffset >= bestFailedMatchesOffset) {
			if (startOffset > bestFailedMatchesOffset) {
				bestFailedMatchesOffset = startOffset
				bestFailedMatches = [terminal]
			} else {
				bestFailedMatches.push(terminal)
			}
		}
	}

	function tryParse(grammarElement: GrammarElement, startOffset: number): ParseResult | null {
		if (grammarElement.cached === true) {
			return tryParseCached(grammarElement, startOffset)
		} else {
			return tryParseUncached(grammarElement, startOffset)
		}
	}

	type Slot = Map<GrammarElement, ParseResult | null> | undefined

	const cachedParseResults: Slot[] = new Array(inputLength)

	function tryParseCached(grammarElement: GrammarElement, startOffset: number): ParseResult | null {
		let slot = cachedParseResults[startOffset]

		if (slot === undefined) {
			slot = new Map<GrammarElement, ParseResult | null>()

			cachedParseResults[startOffset] = slot
		} else {
			const cachedResult = slot.get(grammarElement)

			if (cachedResult !== undefined) {
				return cachedResult
			}
		}

		const parseResult = tryParseUncached(grammarElement, startOffset)

		slot.set(grammarElement, parseResult)

		return parseResult
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
				if (startOffset >= inputLength) {
					updateBestFailedMatchesIfNeeded(grammarElement, startOffset)

					return null
				}

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

						if (namedGroupIndicesIdentifiers.length !== groupsIndices.length - 1) {
							throw new Error(`The regular expression /${grammarElement.regExp.source}/ contains a combination of named and unnamed groups. Due to limitations of the JavaScript RegExp engine, it is impossible to reliably identify the ordering of this combination, please use either all unnamed or named groups, but not both.`)
						}
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

					nodes = [{
						name: grammarElement.name,
						startOffset: matchStartOffset,
						endOffset: matchEndOffset,
						sourceText: inputString.substring(matchStartOffset, matchEndOffset),
						children
					}]
				}

				const parseResult: ParseResult = {
					endOffset: matchEndOffset,
					nodes
				}

				return parseResult
			}

			case 'Nonterminal': {
				const result = tryParse(grammarElement.content, startOffset)

				if (result === null) {
					return null
				}

				let newNode: ParseTreeNode = {
					name: grammarElement.name,
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

	const lastNode = result?.nodes?.[result.nodes.length - 1]

	if (lastNode && lastNode.endOffset >= inputLength) {
		return result.nodes
	} else {
		if (bestFailedMatches.length > 0) {
			const possibleMatches = bestFailedMatches.map(match => {
				if (match.type === 'StringTerminal') {
					return `'${match.content}'`
				} else {
					return match.name
				}
			})

			const possibleMatchesWithoutDuplicates = [...(new Set(possibleMatches))]

			let possibleMatchesString: string

			if (possibleMatchesWithoutDuplicates.length > 1) {
				possibleMatchesString = `any of ${possibleMatchesWithoutDuplicates.join(', ')}`
			} else {
				possibleMatchesString = possibleMatchesWithoutDuplicates[0]
			}

			throw new Error(`Failed parsing the input text. Expected ${possibleMatchesString} at position ${bestFailedMatchesOffset}.`)
		} else {
			throw new Error(`Failed parsing the input text. Parsed length was ${lastNode?.endOffset ?? 0}. Input length was ${inputLength}.`)
		}
	}
}

export interface ParseResult {
	endOffset: number
	nodes: ParseTreeNode[] | undefined
}

export interface ParseTreeNode {
	name: string
	startOffset: number
	endOffset: number
	sourceText: string
	children: ParseTreeNode[] | undefined
}
