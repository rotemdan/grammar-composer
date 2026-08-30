import { isArray, isFunction, isString } from '../utilities/Utilities.js'

import { detectAndAnnotateOptionalNodes, detectAndErrorOnLeftRecursion } from './StaticAnalysis.js'
import { Grammar, Nonterminal, GrammarElement, StringTerminal, Sequence, NonterminalReference, Production } from './Grammar.js'

/////////////////////////////////////////////////////////////////////////////////////////////////
// Grammar builder method
/////////////////////////////////////////////////////////////////////////////////////////////////
export function buildGrammar<T extends GrammarDefinition>(
	definitionObject: T | (new () => T),
	startProductionName: keyof T,
	options?: GrammarBuilderOptions<T>): Grammar<T> {

	options = {
		unwrappedNonterminalNames: [],
		...options
	}

	if (isFunction(definitionObject)) {
		definitionObject = new definitionObject()
	}

	const nameLookup = new Map<any, keyof T>()
	const nonterminalLookup = new Map<Function, Nonterminal>()
	const optionalNonterminalLookup = new Map<Function, Nonterminal>()

	for (const key of Object.keys(definitionObject)) {
		const objectProperty = definitionObject[key]

		nameLookup.set(objectProperty, key)

		if (!isFunction(objectProperty)) {
			throw new Error(`Grammar definition contains a property '${key}', which is not a function. All object properties must be productions, declared as functions.`)
		}

		const productionContent = objectProperty.call(definitionObject)
		const normalizedProduction = productionToGrammarElement(productionContent)
		const isUnwrappedNonterminal = options.unwrappedNonterminalNames?.includes(key) === true

		const newNonterminal = nonterminal(key, normalizedProduction, isUnwrappedNonterminal)
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
		const preparedContent = prepareGrammarElement(
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

function prepareGrammarElement(
	rootElement: GrammarElement,
	nonterminalLookup: Map<Function, Nonterminal>,
	optionalNonterminalLookup: Map<Function, Nonterminal>,
	getNewCacheId: () => number
): GrammarElement {
	function prepare(element: GrammarElement): GrammarElement {
		const setCacheIdIfNeeded = (element: GrammarElement) => {
			if (element.cached === true) {
				element.cacheId = getNewCacheId()
			}

			return element
		}

		switch (element.type) {
			case 'StringTerminal':
			case 'Nonterminal': {
				return setCacheIdIfNeeded({
					...element
				})
			}

			case 'PatternTerminal': {
				return setCacheIdIfNeeded({
					...element,
				})
			}

			case 'Repetition': {
				return setCacheIdIfNeeded({
					...element,
					content: prepare(element.content),
				})
			}

			case 'Sequence':
			case 'Choice': {
				return setCacheIdIfNeeded({
					...element,
					members: element.members.map(element => prepare(element)),
				})
			}

			case 'NonterminalReference': {
				const reference = element.reference

				let nonterminal: Nonterminal | undefined

				if (element.optional) {
					nonterminal = optionalNonterminalLookup.get(reference)
				} else {
					nonterminal = nonterminalLookup.get(reference)
				}

				if (!nonterminal) {
					throw new Error(`Couldn't resolve function reference in grammar element: ${JSON.stringify(element)}`)
				}

				if (element.cached === true) {
					return {
						...nonterminal,

						cached: true,
						cacheId: getNewCacheId(),

						grammarNonterminal: nonterminal.grammarNonterminal ?? nonterminal
					}
				} else {
					return nonterminal
				}
			}
		}
	}

	return prepare(rootElement)
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

function nonterminal(name: string, content: GrammarElement, unwrapped: boolean): Nonterminal {
	if (name.length < 1) {
		throw new Error(`A nonterminal name must include at least 1 character.`)
	}

	return {
		type: 'Nonterminal',
		name,
		content,

		optional: false,
		cached: false,
		unwrapped,
	}
}

function sequence(members: GrammarElement[]): Sequence {
	return {
		type: 'Sequence',
		members,
		optional: false,

		cached: false,
	}
}

function unresolvedReference(reference: Function): NonterminalReference {
	return {
		type: 'NonterminalReference',
		reference,
		optional: false,

		cached: false,
	}
}

export function productionToGrammarElement(production: Production): GrammarElement {
	if (isString(production)) {
		return stringTerminal(production)
	} else if (isArray(production)) {
		const normalizedMembers = production.map(element => productionToGrammarElement(element))

		return sequence(normalizedMembers)
	} else if (isFunction(production)) {
		return unresolvedReference(production)
	} else {
		return production
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Builder type definitions
/////////////////////////////////////////////////////////////////////////////////////////////////
export interface GrammarBuilderOptions<T> {
	unwrappedNonterminalNames?: GrammarNonterminalNames<T>
}

export type GrammarNonterminalNames<T> = (keyof T)[]

export type GrammarDefinition = { [key: string]: any }
