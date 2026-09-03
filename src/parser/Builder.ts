import { isArray, isFunction, isString } from '../utilities/Utilities.js'

import { detectAndAnnotateOptionalNodes, detectAndErrorOnLeftRecursion } from './StaticAnalysis.js'
import { Grammar, Nonterminal, GrammarNode, StringTerminal, Sequence, NonterminalReference, GrammarExpression } from './Grammar.js'

/////////////////////////////////////////////////////////////////////////////////////////////////
// Grammar builder method
/////////////////////////////////////////////////////////////////////////////////////////////////
export function buildGrammar<T extends GrammarDefinition>(
	definitionObject: T | (new () => T),
	startProductionName: keyof T,
	options?: GrammarBuilderOptions<T>): Grammar<T> {

	options = {
		unfoldedNonterminalNames: [],
		...options
	}

	if (isFunction(definitionObject)) {
		definitionObject = new definitionObject()
	}

	const nameLookup = new Map<any, keyof T>()
	const nonterminalLookup = new Map<Function, Nonterminal>()
	const optionalNonterminalLookup = new Map<Function, Nonterminal>()

	for (const key of getProductionNames(definitionObject)) {
		const objectProperty = definitionObject[key]

		nameLookup.set(objectProperty, key)

		if (!isFunction(objectProperty)) {
			throw new Error(`Grammar definition contains a property '${key}', which is not a function. All object properties must be productions, declared as functions.`)
		}

		const productionContent = objectProperty.call(definitionObject)
		const productionContentNode = grammarExpressionToNode(productionContent)
		const isUnfoldedNonterminal = options.unfoldedNonterminalNames?.includes(key) === true

		const newNonterminal = nonterminal(key, productionContentNode, isUnfoldedNonterminal)
		const newOptionalNonterminal = {
			...newNonterminal,
			optional: true,
			grammarNonterminal: newNonterminal,
		}

		nonterminalLookup.set(objectProperty, newNonterminal)
		optionalNonterminalLookup.set(objectProperty, newOptionalNonterminal)
	}

	let cacheIdCounter = 0
	const getNewCacheId = () => {
		const newCacheId = cacheIdCounter
		cacheIdCounter += 1

		return newCacheId
	}

	for (const [func, nonterminal] of nonterminalLookup) {
		const preparedContent = prepareGrammarNode(
			nonterminal.content,
			nonterminalLookup,
			optionalNonterminalLookup,
			getNewCacheId)

		nonterminal.content = preparedContent

		const optionalNonterminal = optionalNonterminalLookup.get(func)!

		// The optional wrapper should share the already-resolved content
		// object (which now contains only resolved Nonterminal refs, no
		// NonterminalReferences left). Sharing is safe because optional
		// detection works on canonical identity and nodes are mutated
		// only via the `optional` flag on the wrapper itself.
		optionalNonterminal.content = preparedContent
	}

	const startNonterminal = nonterminalLookup.get(definitionObject[startProductionName] as Function)

	if (!startNonterminal) {
		throw new Error(`Couldn't find a start production named '${startProductionName as string}'.`)
	}

	detectAndAnnotateOptionalNodes(startNonterminal)
	detectAndErrorOnLeftRecursion(startNonterminal)

	const nonterminals: { [key in keyof T]: Nonterminal } = {} as any

	for (const [key, nonterminal] of nonterminalLookup) {
		nonterminals[nameLookup.get(key)!] = nonterminal
	}

	return new Grammar<T>(
		nonterminals,
		startProductionName,
		cacheIdCounter
	)
}

function getProductionNames(definitionObject: GrammarDefinition): string[] {
	const keys: string[] = []
	const seen = new Set<any>()

	// Walk the prototype chain (stopping before Object.prototype) so that
	// productions declared as prototype methods -- including inherited ones --
	// are picked up in addition to instance fields.
	let current: object | null = definitionObject

	while (current !== null && current !== Object.prototype) {
		for (const key of Object.getOwnPropertyNames(current)) {
			if (key === 'constructor' || seen.has(key)) {
				continue
			}

			seen.add(key)
			keys.push(key)
		}

		current = Object.getPrototypeOf(current)
	}

	return keys
}

function prepareGrammarNode(
	rootNode: GrammarNode,
	nonterminalLookup: Map<Function, Nonterminal>,
	optionalNonterminalLookup: Map<Function, Nonterminal>,
	getNewCacheId: () => number
): GrammarNode {
	function prepare(node: GrammarNode): GrammarNode {
		const setCacheIdIfNeeded = (node: GrammarNode) => {
			if (node.cached === true) {
				node.cacheId = getNewCacheId()
			}

			return node
		}

		switch (node.type) {
			case 'StringTerminal':
			case 'Nonterminal': {
				return setCacheIdIfNeeded({
					...node
				})
			}

			case 'PatternTerminal': {
				return setCacheIdIfNeeded({
					...node,
				})
			}

			case 'Repetition': {
				return setCacheIdIfNeeded({
					...node,
					content: prepare(node.content),
				})
			}

			case 'Sequence':
			case 'Choice': {
				return setCacheIdIfNeeded({
					...node,
					members: node.members.map(member => prepare(member)),
				})
			}

			case 'NonterminalReference': {
				const reference = node.reference

				let nonterminal: Nonterminal | undefined

				if (node.optional) {
					nonterminal = optionalNonterminalLookup.get(reference)
				} else {
					nonterminal = nonterminalLookup.get(reference)
				}

				if (!nonterminal) {
					throw new Error(`Couldn't resolve function reference in grammar node: ${JSON.stringify(node)}`)
				}

				if (node.cached === true) {
					return {
						...nonterminal,

						cached: true,
						cacheId: getNewCacheId(),

						canonicalNonterminal: nonterminal.canonicalNonterminal ?? nonterminal
					}
				} else {
					return nonterminal
				}
			}
		}
	}

	return prepare(rootNode)
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Internal AST builder methods
/////////////////////////////////////////////////////////////////////////////////////////////////
function stringTerminal(content: string): StringTerminal {
	if (content.length < 1) {
		throw new Error(`A string terminal must have a length of at least 1 character`)
	}

	return {
		type: 'StringTerminal',
		content,
		optional: false,

		cached: false,
	}
}

function nonterminal(name: string, content: GrammarNode, unfolded: boolean): Nonterminal {
	if (name.length < 1) {
		throw new Error(`A nonterminal name must include at least 1 character.`)
	}

	return {
		type: 'Nonterminal',
		name,
		content,

		optional: false,
		cached: false,
		unfolded,
	}
}

function sequence(members: GrammarNode[]): Sequence {
	return {
		type: 'Sequence',
		members,
		optional: false,

		cached: false,
	}
}

function unresolvedNonterminalReference(nonterminalReferenceFunction: Function): NonterminalReference {
	return {
		type: 'NonterminalReference',
		reference: nonterminalReferenceFunction,
		optional: false,

		cached: false,
	}
}

export function grammarExpressionToNode(grammarExpression: GrammarExpression): GrammarNode {
	if (isString(grammarExpression)) {
		return stringTerminal(grammarExpression)
	} else if (isArray(grammarExpression)) {
		const memberNodes = grammarExpression.map(member => grammarExpressionToNode(member))

		return sequence(memberNodes)
	} else if (isFunction(grammarExpression)) {
		return unresolvedNonterminalReference(grammarExpression)
	} else {
		return grammarExpression
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Builder type definitions
/////////////////////////////////////////////////////////////////////////////////////////////////
export interface GrammarBuilderOptions<T> {
	unfoldedNonterminalNames?: GrammarNonterminalNames<T>
}

export type GrammarNonterminalNames<T> = (keyof T)[]

export type GrammarDefinition = { [key: string]: any }
