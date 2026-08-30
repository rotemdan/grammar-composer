import { Pattern, buildRegExp, inputStart, isPatternOptional } from 'regexp-composer'
import { isArray } from '../utilities/Utilities.js'

import { parse } from './Parser.js'
import { validatePatternCaptureGroups } from './StaticAnalysis.js'
import { productionToGrammarElement } from './Builder.js'

/////////////////////////////////////////////////////////////////////////////////////////////////
// Grammar class
/////////////////////////////////////////////////////////////////////////////////////////////////
export class Grammar<T> {
	readonly productions: Record<keyof T, any>
	readonly startProductionName: keyof T

	readonly maxCacheId: number

	constructor(
		productions: Record<keyof T, any>,
		startProductionName: keyof T,
		maxCacheId: number) {

		this.startProductionName = startProductionName
		this.productions = productions
		this.maxCacheId = maxCacheId
	}

	parse(text: string) {
		return parse(text, this)
	}

	get rootElement() {
		return this.productions[this.startProductionName]
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Exported grammar builder functions
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
