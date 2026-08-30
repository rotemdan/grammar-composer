import { test, expect } from 'vitest'

import * as G from '../../src/exports/Exports.js'
import * as R from 'regexp-composer'

////////////////////////////////////////////////////////////////////////////
// Agents: scratchpad playground. Do not treat as regression tests.
////////////////////////////////////////////////////////////////////////////

function expectError(run: () => any): any {
	try {
		run()
	}
	catch (error: any) {
		return error
	}
	return undefined
}

test('Probe: nullable through recursion (possibly)', () => {
	// p => possibly(q), q => possibly(p)  - both nullable, terminating only via possibly
	class TestGrammar {
		root = () => [this.p, 'e']
		p = () => G.possibly(this.q)
		q = () => G.possibly(this.p)
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	expect(grammar.parse('e')).toMatchObject([{ name: 'root', sourceText: 'e' }])
	expect(grammar.parse('e')).toBeDefined()
})

test('Probe: cycle with base case resolves correctly', () => {
	class TestGrammar {
		// item* then terminator
		root = () => G.zeroOrMore([this.marker, 'a'])
		marker = () => G.possibly('m')
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	console.log('cycle base:', JSON.stringify(grammar.parse('amamama')))
	console.log('cycle base empty-ish:', JSON.stringify(grammar.parse('a')))
})

test('Probe: repetition of optional nullable production', () => {
	class TestGrammar {
		root = () => [G.oneOrMore(this.opt), '!']

		// nullable production that can match empty
		opt = () => G.possibly('a')
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	console.log('oneOrMore nullable a!:', JSON.stringify(grammar.parse('aa!')))
	console.log('oneOrMore nullable !:', JSON.stringify(grammar.parse('!')))
})

test('Probe: pattern unnamed groups', () => {
	class TestGrammar {
		root = () => G.pattern([
			R.capture(R.oneOrMore(R.charRange('a', 'z'))),
			'-',
			R.capture(R.oneOrMore(R.digit)),
		])
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	const result = grammar.parse('ab-42')
	console.log('unnamed groups:', JSON.stringify(result, undefined, 2))
})

test('Probe: pattern with non-participating middle group', () => {
	class TestGrammar {
		root = () => G.pattern([
			R.captureAs('first', R.oneOrMore(R.digit)),
			R.possibly([R.captureAs('middle', 'm')]),
			R.captureAs('last', R.oneOrMore(R.digit)),
		])
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	const withMiddle = grammar.parse('1m2')
	console.log('with middle:', JSON.stringify(withMiddleToNames(grammar.parse('1m2'))))
	console.log('without middle:', JSON.stringify(withMiddleToNames(grammar.parse('12'))))

	function withMiddleToNames(nodes: any[] | undefined) {
		return (nodes ?? []).map((n: any) => n.name)
	}
})

test('Probe: pattern groups with identical spans', () => {
	class TestGrammar {
		root = () => G.pattern([
			R.captureAs('outer', [
				R.captureAs('inner', R.oneOrMore(R.digit)),
			]),
			R.captureAs('alsoSame', R.oneOrMore(R.digit)),
		])
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	console.log('identical spans:', JSON.stringify(grammar.parse('123'), undefined, 2))
})

test('Probe: cache correctness across backtracking', () => {
	// cached element reached from two different choice branches at same offset
	class TestGrammar {
		root = () => [
			G.anyOf(
				['x', this.num],
				['y', this.num, '!'],
			)
		]

		num = () => G.cached(G.pattern([R.oneOrMore(R.digit)]))
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	console.log('x123:', JSON.stringify(grammar.parse('x123')))
	console.log('x123!! malformed:', JSON.stringify((() => { try { return grammar.parse('x123]]') } catch (e: any) { return 'ERR: ' + e.message.split('\n')[0] } })()))
})

test('Probe: cached nonterminal reused serially', () => {
	class TestGrammar {
		root = () => [this.word, ' ', this.word, '.', this.word]

		word = () => G.cached(G.pattern([R.oneOrMore(R.charRange('a', 'z'))]))
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	console.log('cached reuse:', JSON.stringify(grammar.parse('abc def.'), undefined, 2))
})

test('Probe: deep repetition with production nodes', () => {
	class TestGrammar {
		root = () => G.zeroOrMore(this.item)

		item = () => ['i', G.possibly(this.inner)]

		inner = () => ['n', G.zeroOrMore('n')]
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	const result = grammar.parse('iinniiinnn')
	console.log('deep repetition:', JSON.stringify(result, undefined, 2))
})
