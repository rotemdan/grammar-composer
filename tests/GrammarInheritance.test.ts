import { test, expect } from 'vitest'

import * as G from '../src/exports/Exports.js'

////////////////////////////////////////////////////////////////////////////
// Regression tests for grammar inheritance:
// a subclass grammar extending a base grammar class must work, including
// inherited productions, overridden productions and new productions.
////////////////////////////////////////////////////////////////////////////

test('Grammar inheritance: subclass extends base without overrides', () => {
	class Grammar1 {
		root = (): G.GrammarExpression => [this.a, G.possibly(this.b), 'c']
		a = (): G.GrammarExpression => ['a']
		b = (): G.GrammarExpression => ['b']
	}

	class Grammar2 extends Grammar1 {
		c = (): G.GrammarExpression => ['c', 'd']
	}

	const grammar = G.buildGrammar(new Grammar2(), 'root')
	const parseTree: any = grammar.parse('ac')

	expect(JSON.stringify(parseTree)).toContain('a')
})

test('Grammar inheritance: subclass overrides a base production', () => {
	class Grammar1 {
		root = (): G.GrammarExpression => [this.a, this.b]
		a = (): G.GrammarExpression => ['a']
		b = (): G.GrammarExpression => ['b']
	}

	class Grammar2 extends Grammar1 {
		b = (): G.GrammarExpression => ['b', this.c]
		c = (): G.GrammarExpression => ['c']
	}

	const grammar = G.buildGrammar(new Grammar2(), 'root')
	const parseTree: any = grammar.parse('abc')

	// The override of `b` must be picked up
	expect(JSON.stringify(parseTree)).toContain('c')
})

test('Grammar inheritance: subclass overrides the start production', () => {
	class Grammar1 {
		root = (): G.GrammarExpression => [this.a]
		a = (): G.GrammarExpression => ['a']
	}

	class Grammar2 extends Grammar1 {
		root = (): G.GrammarExpression => [this.a, this.b]
		b = (): G.GrammarExpression => ['b']
	}

	const grammar = G.buildGrammar(new Grammar2(), 'root')
	const parseTree: any = grammar.parse('ab')

	expect(JSON.stringify(parseTree)).toContain('b')
})

test('Grammar inheritance: prototype-method style with inheritance', () => {
	class Grammar1 {
		root() { return [this.a, this.b] }
		a() { return ['a'] }
		b() { return ['b'] }
	}

	class Grammar2 extends Grammar1 {
		c() { return ['c', this.a] }
	}

	const grammar = G.buildGrammar(new Grammar2() as any, 'root')
	const parseTree: any = grammar.parse('ab')

	expect(JSON.stringify(parseTree)).toContain('b')
})

test('Control: possibly(nonterminal) without any subclassing', () => {
	class Grammar1 {
		root = (): G.GrammarExpression => [this.a, G.possibly(this.b), 'c']
		a = (): G.GrammarExpression => ['a']
		b = (): G.GrammarExpression => ['b']
	}

	const grammar = G.buildGrammar(new Grammar1(), 'root')
	const parseTree: any = grammar.parse('ac')

	expect(JSON.stringify(parseTree)).toContain('a')
})
