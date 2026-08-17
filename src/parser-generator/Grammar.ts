import { Pattern, buildRegExp, inputStart, isPatternOptional } from 'regexp-composer'
import { isArray, isBoolean, isFunction, isString } from '../utilities/Utilities.js'

import { parse } from './TopDownParser.js'
import { detectAndAnnotateOptionalNodes, detectAndErrorOnLeftRecursion, validatePatternCaptureGroups } from './StaticAnalysis.js'

/////////////////////////////////////////////////////////////////////////////////////////////////
// Grammar builder method
/////////////////////////////////////////////////////////////////////////////////////////////////
export function buildGrammar<T extends { [key: string]: any }>(
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

	for (const key in definitionObject) {
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
// Exported AST builder functions
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
	if (members.length === 0) {
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
	if (members.length === 0) {
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

	validatePatternCaptureGroups(pattern)

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
// Grammar class
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

/////////////////////////////////////////////////////////////////////////////////////////////////
// Type definitions
/////////////////////////////////////////////////////////////////////////////////////////////////
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

	// The name of the grammar property this element was assigned to, if any.
	// Used by the parser to refer to the element by name in error messages.
	name?: string
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
	unwrapped: boolean

	// The canonical nonterminal as defined in the grammar. Clones created for
	// optional references and cached references keep a reference to the original,
	// so identity comparisons work across clones.
	grammarNonterminal?: Nonterminal
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

/////////////////////////////////////////////////////////////////////////////////////////////////
// Builder type definitions
/////////////////////////////////////////////////////////////////////////////////////////////////
export interface GrammarBuilderOptions<T> {
	unwrappedNonterminalNames?: GrammarNonterminalNames<T>
}

export type GrammarNonterminalNames<T> = (keyof T)[]
