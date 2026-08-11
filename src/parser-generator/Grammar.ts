import { Pattern, buildRegExp, inputStart, isPatternOptional } from 'regexp-composer'
import { isArray, isBoolean, isFunction, isString } from '../utilities/Utilities.js'

import { parse } from './TopDownParser.js'

/////////////////////////////////////////////////////////////////////////////////////////////////
// Grammar builder method
/////////////////////////////////////////////////////////////////////////////////////////////////
export function buildGrammar<T extends { [key: string]: any }>(obj: T | (new () => T), startProductionName: keyof T): Grammar<T> {
	if (isFunction(obj)) {
		obj = new obj()
	}

	const nameLookup = new Map<any, keyof T>()
	const nonterminalLookup = new Map<Function, Nonterminal>()
	const optionalNonterminalLookup = new Map<Function, Nonterminal>()

	for (const key in obj) {
		const objectProperty = obj[key]

		nameLookup.set(objectProperty, key)

		if (!isFunction(objectProperty)) {
			continue
		}

		const productionContent = objectProperty.call(obj)
		const normalizedProduction = productionToGrammarElement(productionContent)

		const newNonterminal = nonterminal(key, normalizedProduction)
		const newOptionalNonterminal = { ...newNonterminal, optional: true }

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
		optionalNonterminal.content = preparedContent
	}

	const startNonterminal = nonterminalLookup.get(obj[startProductionName] as Function)

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
// Internal static analysis methods
/////////////////////////////////////////////////////////////////////////////////////////////////
function detectAndAnnotateOptionalNodes(rootNode: GrammarElement) {
	const visitedNodes = new Set<GrammarElement>()

	const resolvedNodes = new Map<GrammarElement, boolean>()
	const unresolvedNodes = new Map<GrammarElement, { dependencies: Set<GrammarElement>, isChoice: boolean }>()

	function processDepthFirst(node: GrammarElement): boolean | undefined {
		if (visitedNodes.has(node)) {
			return resolvedNodes.get(node)
		}

		visitedNodes.add(node)

		switch (node.type) {
			case 'StringTerminal':
			case 'PatternTerminal': {
				resolvedNodes.set(node, node.optional)

				return node.optional
			}

			case 'Nonterminal':
			case 'Repetition': {
				const result = processDepthFirst(node.content)

				if (node.optional) {
					resolvedNodes.set(node, true)

					return true
				} else if (isBoolean(result)) {
					resolvedNodes.set(node, result)

					return result
				} else {
					unresolvedNodes.set(node, { dependencies: new Set([node.content]), isChoice: false })

					return undefined
				}
			}

			case 'Sequence': {
				const dependencies = new Set<GrammarElement>()

				let hasNonOptionalResolvedMember = false

				for (const element of node.members) {
					const result = processDepthFirst(element)

					if (isBoolean(result)) {
						if (result === false) {
							hasNonOptionalResolvedMember = true
						}
					} else {
						dependencies.add(element)
					}
				}

				if (node.optional == true) {
					resolvedNodes.set(node, true)

					return true
				} else if (hasNonOptionalResolvedMember) {
					resolvedNodes.set(node, false)

					return false
				} else if (dependencies.size == 0) {
					resolvedNodes.set(node, true)

					return true
				} else {
					unresolvedNodes.set(node, { dependencies, isChoice: false })

					return undefined
				}
			}

			case 'Choice': {
				const dependencies = new Set<GrammarElement>()
				let hasOptionalResolvedMember = false

				for (const element of node.members) {
					const result = processDepthFirst(element)

					if (isBoolean(result)) {
						if (result === true) {
							hasOptionalResolvedMember = true
						}
					} else {
						dependencies.add(element)
					}
				}

				if (node.optional == true) {
					resolvedNodes.set(node, true)

					return true
				} else if (hasOptionalResolvedMember) {
					resolvedNodes.set(node, true)

					return true
				} else if (dependencies.size == 0) {
					resolvedNodes.set(node, false)

					return false
				} else {
					unresolvedNodes.set(node, { dependencies, isChoice: true })

					return undefined
				}
			}
		}

		return undefined
	}

	// Process depth first to resolve the easy cases, for productions that contain
	// no cyclic references:
	processDepthFirst(rootNode)

	// Now the remainder consists of nodes containing cyclic references that have not yet been resolved.
	// Use a form of iterative elimination and substitution to resolve them:
	while (unresolvedNodes.size > 0) {
		// This variable tracks whether at least one dependency was resolved, in any node.
		// If it stays false, it means that no improvement was made during the iteration,
		// and we should exit the loop.
		let atLastOneDependencyResolvedInAnyNode = false
		const nodesToDelete: GrammarElement[] = []

		// Scan the unresolved nodes to locate any new resolved dependencies
		for (const [node, { dependencies, isChoice }] of unresolvedNodes) {
			let nodeResolved = false

			// Iterate over all unresolved dependencies for the node
			for (const dependency of Array.from(dependencies)) {
				// Check if the dependency has been resolved
				const value = resolvedNodes.get(dependency)

				if (value !== undefined) {
					// If it did, record that some dependencies were resolved
					atLastOneDependencyResolvedInAnyNode = true

					if (isChoice) {
						if (value === true) {
							resolvedNodes.set(node, true)
							nodeResolved = true
							break
						}
					} else {
						if (value === false) {
							resolvedNodes.set(node, false)
							nodeResolved = true
							break
						}
					}

					dependencies.delete(dependency)
				}
			}

			if (nodeResolved) {
				nodesToDelete.push(node)
			} else if (dependencies.size === 0) {
				if (isChoice) {
					resolvedNodes.set(node, false)
				} else {
					resolvedNodes.set(node, true)
				}

				nodesToDelete.push(node)
			}
		}

		for (const node of nodesToDelete) {
			unresolvedNodes.delete(node)
		}

		// If not even one dependency was eliminated for any node,
		// it means that only mutually cyclic nodes are left unresolved, so exit the loop.
		if (!atLastOneDependencyResolvedInAnyNode) {
			break
		}
	}

	// All remaining unresolved nodes must now be optional,
	// since they are all mutually cyclic and all their non-cyclic grammar elements are known to be optional.
	for (const node of unresolvedNodes.keys()) {
		resolvedNodes.set(node, true)
		unresolvedNodes.delete(node)
	}

	// Finally set the 'optional' property of all nodes based on the detected values.
	for (const [node, isOptional] of resolvedNodes) {
		node.optional = isOptional
	}
}

function detectAndErrorOnLeftRecursion(rootNode: GrammarElement) {
	const currentlyIteratedNodes = new Set<GrammarElement>()

	function detect(node: GrammarElement) {
		if (currentlyIteratedNodes.has(node)) {
			if (node.type === 'Nonterminal') {
				throw new Error(`Detected left recursion for nonterminal '${node.name}'.`)
			} else {
				throw new Error(`Detected left recursion for node: ${JSON.stringify(node, undefined, 4)}`)
			}
		}

		currentlyIteratedNodes.add(node)

		switch (node.type) {
			case 'Nonterminal':
			case 'Repetition': {
				detect(node.content)

				break
			}

			case 'Sequence': {
				for (const member of node.members) {
					detect(member)

					if (!member.optional) {
						break
					}
				}

				break
			}

			case 'Choice': {
				for (const member of node.members) {
					detect(member)
				}

				break
			}
		}

		currentlyIteratedNodes.delete(node)
	}

	detect(rootNode)
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Exported builder methods
/////////////////////////////////////////////////////////////////////////////////////////////////
export function zeroOrMore(content: Production): Repetition {
	return {
		type: 'Repetition',
		content: productionToGrammarElement(content),
		optional: true,
		cached: false,
	}
}

export function oneOrMore(content: Production): Repetition {
	return {
		type: 'Repetition',
		content: productionToGrammarElement(content),
		optional: false,
		cached: false,
	}
}

export function anyOf(...members: Production[]): Choice {
	if (members.length == 0) {
		throw new Error(`'anyOf' requires at least one member.`)
	}

	const normalizedMembers = members.map(member => productionToGrammarElement(member))

	return {
		type: 'Choice',
		members: normalizedMembers,
		optional: false,
		exhaustive: false,
		cached: false,
	}
}

export function bestOf(...members: Production[]): Choice {
	if (members.length == 0) {
		throw new Error(`'bestOf' requires at least one member.`)
	}

	const normalizedMembers = members.map(member => productionToGrammarElement(member))

	return {
		type: 'Choice',
		members: normalizedMembers,
		optional: false,
		exhaustive: true,

		cached: false,
	}
}

export function possibly<T extends Production>(content: Production): T {
	return { ...productionToGrammarElement(content), optional: true } as T
}

export function pattern(pattern: Pattern): PatternTerminal {
	if (isArray(pattern)) {
		pattern = [inputStart, ...pattern]
	} else {
		pattern = [inputStart, pattern]
	}

	const regExp = buildRegExp(pattern)
	const optional = isPatternOptional(pattern)

	return {
		type: 'PatternTerminal',
		pattern,
		regExp,
		optional,

		cached: false,
	}
}

export function cached<T extends Production>(content: Production): T {
	return { ...productionToGrammarElement(content), cached: true } as T
}

export function uncached<T extends Production>(content: Production): T {
	return { ...productionToGrammarElement(content), cached: false } as T
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Internal builder methods
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

function nonterminal(name: string, content: GrammarElement): Nonterminal {
	if (name.length < 1) {
		throw new Error(`A nonterminal name must include at least 1 character.`)
	}

	return {
		type: 'Nonterminal',
		name,
		content,
		optional: false,

		cached: false,
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

function productionToGrammarElement(production: Production): GrammarElement {
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
// Type definitions
/////////////////////////////////////////////////////////////////////////////////////////////////
export class Grammar<T> {
	readonly productions: Record<keyof T, any>
	readonly startProductionName: keyof T

	readonly maxCacheId: number

	constructor(productions: Record<keyof T, any>, startProductionName: keyof T, maxCacheId: number) {
		this.startProductionName = startProductionName
		this.productions = productions
		this.maxCacheId = maxCacheId
	}

	parse(text: string) {
		return parse(text, this)
	}

	get rootElement() {
		return (this.productions as any)[this.startProductionName]
	}
}

export type Production = string | GrammarElement | (() => Production) | Production[]

export type GrammarElement =
	StringTerminal |
	PatternTerminal |
	Nonterminal |
	Sequence |
	Repetition |
	Choice |
	NonterminalReference

interface GrammarElementBase {
	type: string
	optional: boolean

	cached: boolean
	cacheId?: number
}

export type Terminal = StringTerminal | PatternTerminal

export interface StringTerminal extends GrammarElementBase {
	type: 'StringTerminal'
	content: string
}

export interface PatternTerminal extends GrammarElementBase {
	type: 'PatternTerminal'
	pattern: Pattern
	regExp: RegExp
}

export interface Nonterminal extends GrammarElementBase {
	type: 'Nonterminal'
	name: string
	content: GrammarElement
}

export interface Sequence extends GrammarElementBase {
	type: 'Sequence'
	members: GrammarElement[]
}

export interface Repetition extends GrammarElementBase {
	type: 'Repetition'
	content: GrammarElement
}

export interface Choice extends GrammarElementBase {
	type: 'Choice'
	members: GrammarElement[]
	exhaustive: boolean
}

export interface NonterminalReference extends GrammarElementBase {
	type: 'NonterminalReference'
	reference: Function
}
