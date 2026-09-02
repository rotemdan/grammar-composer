import { Pattern, buildRegExp, inputStart, isPatternOptional } from 'regexp-composer'
import { isArray } from '../utilities/Utilities.js'

import { parse } from './Parser.js'
import { validatePatternCaptureGroups } from './StaticAnalysis.js'
import { grammarExpressionToNode } from './Builder.js'

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

	get rootNode() {
		return this.productions[this.startProductionName]
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Exported grammar builder functions
/////////////////////////////////////////////////////////////////////////////////////////////////
export function zeroOrMore(content: GrammarExpression): Repetition {
	return {
		type: 'Repetition',
		content: grammarExpressionToNode(content),
		optional: true,
		cached: false,
	}
}

export function oneOrMore(content: GrammarExpression): Repetition {
	return {
		type: 'Repetition',
		content: grammarExpressionToNode(content),
		optional: false,
		cached: false,
	}
}

export function anyOf(...members: GrammarExpression[]): Choice {
	if (members.length === 0) {
		throw new Error(`'anyOf' requires at least one member.`)
	}

	const memberNodes = members.map(member => grammarExpressionToNode(member))

	return {
		type: 'Choice',
		members: memberNodes,
		optional: false,
		exhaustive: false,
		cached: false,
	}
}

export function bestOf(...members: GrammarExpression[]): Choice {
	if (members.length === 0) {
		throw new Error(`'bestOf' requires at least one member.`)
	}

	const memberNodes = members.map(member => grammarExpressionToNode(member))

	return {
		type: 'Choice',
		members: memberNodes,
		optional: false,
		exhaustive: true,

		cached: false,
	}
}

export function possibly<T extends GrammarExpression>(content: GrammarExpression): T {
	return { ...grammarExpressionToNode(content), optional: true } as T
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

export function cached<T extends GrammarExpression>(content: GrammarExpression): T {
	return { ...grammarExpressionToNode(content), cached: true } as T
}

export function uncached<T extends GrammarExpression>(content: GrammarExpression): T {
	return { ...grammarExpressionToNode(content), cached: false } as T
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Type definitions
/////////////////////////////////////////////////////////////////////////////////////////////////
export type GrammarExpression = string | GrammarNode | (() => GrammarExpression) | GrammarExpression[]

export type GrammarNode =
	StringTerminal |
	PatternTerminal |
	Nonterminal |
	Sequence |
	Repetition |
	Choice |
	NonterminalReference

interface GrammarNodeBase {
	type: string
	optional: boolean

	cached: boolean
	cacheId?: number

	// The name of the grammar property this node was assigned to, if any.
	// Used by the parser to refer to the node by name in error messages.
	name?: string
}

export type Terminal = StringTerminal | PatternTerminal

export interface StringTerminal extends GrammarNodeBase {
	type: 'StringTerminal'
	content: string
}

export interface PatternTerminal extends GrammarNodeBase {
	type: 'PatternTerminal'
	pattern: Pattern
	regExp: RegExp
}

export interface Nonterminal extends GrammarNodeBase {
	type: 'Nonterminal'
	name: string
	content: GrammarNode
	unfolded: boolean

	// The canonical nonterminal as defined in the grammar. Clones created for
	// optional references and cached references keep a reference to the original,
	// so identity comparisons work across clones.
	canonicalNonterminal?: Nonterminal
}

export interface Sequence extends GrammarNodeBase {
	type: 'Sequence'
	members: GrammarNode[]
}

export interface Repetition extends GrammarNodeBase {
	type: 'Repetition'
	content: GrammarNode
}

export interface Choice extends GrammarNodeBase {
	type: 'Choice'
	members: GrammarNode[]
	exhaustive: boolean
}

export interface NonterminalReference extends GrammarNodeBase {
	type: 'NonterminalReference'
	reference: Function
}
