import { Pattern, buildRegExp, inputStart, isPatternOptional } from 'regexp-composer'
import { isArray, isBoolean, isFunction, isString } from "./utilities/Utilities.js"

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

		const productionContent = objectProperty()
		const normalizedProduction = productionToGrammarElement(productionContent)

		const newNonterminal = nonterminal(key, normalizedProduction)
		const newOptionalNonterminal = { ...newNonterminal, optional: true }

		nonterminalLookup.set(objectProperty, newNonterminal)
		optionalNonterminalLookup.set(objectProperty, newOptionalNonterminal)
	}

	let uniqueIdCounter = 0
	const uniqueIdSource = () => uniqueIdCounter++

	for (const [func, nonterminal] of nonterminalLookup) {
		const preparedContent = prepareGrammarElement(nonterminal.content, nameLookup as Map<any, string>, nonterminalLookup, optionalNonterminalLookup, uniqueIdSource)

		nonterminal.content = preparedContent

		const optionalNonterminal = optionalNonterminalLookup.get(func)!
		optionalNonterminal.content = preparedContent
	}

	let startNonterminal = nonterminalLookup.get(obj[startProductionName] as Function)

	if (!startNonterminal) {
		throw new Error(`Couldn't find a start production named '${startProductionName as string}'.`)
	}

	detectAndAnnotateOptionalNodes(startNonterminal)
	detectAndErrorOnLeftRecursion(startNonterminal)

	const nonterminals: { [key in keyof T]: Nonterminal } = {} as any

	for (const [key, nonterminal] of nonterminalLookup) {
		nonterminals[nameLookup.get(key)!] = nonterminal
	}

	return new Grammar(
		nonterminals[startProductionName],
		nonterminals,
		uniqueIdCounter
	 ) as Grammar<T>
}

function prepareGrammarElement(
	rootElement: GrammarElement,
	nameLookup: Map<any, string>,
	nonterminalLookup: Map<Function, Nonterminal>,
	optionalNonterminalLookup: Map<Function, Nonterminal>,
	getUniqueId: () => number
): GrammarElement {
	function prepare(element: GrammarElement): GrammarElement {
		switch (element.type) {
			case 'StringTerminal':
			case 'Nonterminal': {
				if (element.uniqueId === undefined) {
					element.uniqueId = getUniqueId()
				}

				return element
			}

			case 'PatternTerminal': {
				return {
					...element,
					name: nameLookup.get(element) ?? '',
					uniqueId: getUniqueId()
				}
			}

			case 'Repetition': {
				return {
					...element,
					content: prepare(element.content),
					uniqueId: getUniqueId()
				}
			}

			case 'Sequence':
			case 'Choice': {
				return {
					...element,
					members: element.members.map(element => prepare(element)),
					uniqueId: getUniqueId()
				}
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

				if (nonterminal.uniqueId === undefined) {
					nonterminal.uniqueId = getUniqueId()
				}

				return nonterminal
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
	const unresolvedNodes = new Map<GrammarElement, Set<GrammarElement>>()

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
					unresolvedNodes.set(node, new Set([node.content]))

					return undefined
				}
			}

			case 'Sequence':
			case 'Choice': {
				const dependencies = new Set<GrammarElement>()

				let allResolvedElementsAreOptional = true

				for (const element of node.members) {
					const result = processDepthFirst(element)

					if (isBoolean(result)) {
						if (result == false) {
							allResolvedElementsAreOptional = false
						}
					} else {
						dependencies.add(element)
					}
				}

				if (node.optional == true) {
					resolvedNodes.set(node, true)

					return true
				} else if (dependencies.size == 0 || !allResolvedElementsAreOptional) {
					resolvedNodes.set(node, allResolvedElementsAreOptional)

					return allResolvedElementsAreOptional
				} else {
					unresolvedNodes.set(node, dependencies)

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

		// Scan the unresolved nodes to locate any new resolved dependencies
		for (const [node, dependencies] of unresolvedNodes) {
			let nonOptionalDependencyFound = false

			// Iterate over all unresolved dependencies for the node
			for (const dependency of dependencies) {
				// Check if the dependency has been resolved
				const value = resolvedNodes.get(dependency)

				if (value !== undefined) {
					// If it did, record that some dependencies were resolved
					atLastOneDependencyResolvedInAnyNode = true

					if (value === false) {
						// If the value was false, then the entire target node must not be optional
						nonOptionalDependencyFound = true

						break
					} else {
						// If the result was true, remove the dependency from the set
						dependencies.delete(dependency)
					}
				}
			}

			// If either a non-optional dependency was found, or all dependencies were resolved,
			// resolve the target node:
			if (nonOptionalDependencyFound || dependencies.size === 0) {
				const isOptional = !nonOptionalDependencyFound

				resolvedNodes.set(node, isOptional)
				unresolvedNodes.delete(node)
			}
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
		optional: true
	}
}

export function oneOrMore(content: Production): Repetition {
	return {
		type: 'Repetition',
		content: productionToGrammarElement(content),
		optional: false
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
		exhaustive: false
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
		exhaustive: true
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
		name: '[Pattern]',
		pattern,
		regExp,
		optional,
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
		optional: false
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
	}
}

function sequence(members: GrammarElement[]): Sequence {
	return {
		type: 'Sequence',
		members,
		optional: false
	}
}

function unresolvedReference(reference: Function): NonterminalReference {
	return {
		type: 'NonterminalReference',
		reference,
		optional: false
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
	readonly rootElement: Nonterminal
	readonly productions: Record<keyof T, any>
	readonly maxElementId: number

	constructor(rootElement: Nonterminal, productions: Record<keyof T, any>, maxElementId: number) {
		this.rootElement = rootElement
		this.productions = productions
		this.maxElementId = maxElementId
	}

	parse(text: string) {
		return parse(text, this)
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
	uniqueId?: number
	cached?: boolean
}

export type Terminal = StringTerminal | PatternTerminal

export interface StringTerminal extends GrammarElementBase {
	type: 'StringTerminal'
	content: string
}

export interface PatternTerminal extends GrammarElementBase {
	type: 'PatternTerminal'
	name: string
	pattern: Pattern | Pattern[]
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
