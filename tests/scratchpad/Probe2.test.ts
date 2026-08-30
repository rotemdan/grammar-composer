import { test, expect } from 'vitest'

import * as G from '../../src/exports/Exports.js'
import * as R from 'regexp-composer'
import { writeScratchpadOutputToDisk } from '../utilities/Utilities.js'
import { JsonGrammar, jsonGrammarUnwrappedNonterminalNames } from '../../src/tests/test-grammars/JsonGrammar.js'
import { XmlGrammar, xmlGrammarUnwrappedNonterminalNames } from '../../src/tests/test-grammars/XmlGrammar.js'
import { RegExpGrammar, regExpGrammarUnwrappedNonterminalNames } from '../../src/tests/test-grammars/RegExpGrammar.js'
import { jsonSample1, jsonSample2 } from '../../src/tests/test-data/TestData.js'

////////////////////////////////////////////////////////////////////////////
// Agents: scratchpad playground. Do not treat as regression tests.
////////////////////////////////////////////////////////////////////////////

test('Probe: JSON grammar sample1', () => {
	const grammar = G.buildGrammar(JsonGrammar, 'expression', {
		unwrappedNonterminalNames: jsonGrammarUnwrappedNonterminalNames
	})

	const result = grammar.parse(jsonSample1)
	//writeScratchpadOutputToDisk(result, 'json1')
	console.log('json1 root:', JSON.stringify(result, undefined, 2).slice(0, 2000))
})

test('Probe: XML grammar', () => {
	const xmlString = `
<!DOCTYPE web-app>

<menu>
    <header>Adobe SVG Viewer</header>
    <item action="Open" id="Open">Open</item>
    <item action="OpenNew" id="OpenNew">Open New</item>
</menu>
`
	const grammar = G.buildGrammar(XmlGrammar, 'document', {
		unwrappedNonterminalNames: xmlGrammarUnwrappedNonterminalNames
	})

	const result = grammar.parse(xmlString)
	writeScratchpadOutputToDisk(result, 'xml')
	console.log('xml top-level names:', result.map(n => n.name).join(', '))
})

test('Probe: RegExp grammar', () => {
	const regExpString = /^(abcd)*ef+g/.source

	const grammar = G.buildGrammar(RegExpGrammar, 'root', {
		unwrappedNonterminalNames: regExpGrammarUnwrappedNonterminalNames
	})

	const result = grammar.parse(regExpString)
	writeScratchpadOutputToDisk(result, 'regexp')
	console.log('regexp tree:', JSON.stringify(result, undefined, 2))
})

test('Probe: possibly(nonterminal)', () => {
	class TestGrammar {
		root = () => ['a', G.possibly(this.b), 'c']

		b = () => ['b']
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	expect(grammar.parse('abc')).toMatchObject([
		{ name: 'root', sourceText: 'abc', children: [{ name: 'b' }] }
	])

	const withoutB = grammar.parse('ac')
	console.log('without b:', JSON.stringify(withoutB))
})

test('Probe: nullable nonterminal in middle of sequence', () => {
	class TestGrammar {
		root = () => ['a', this.maybeB, 'c']

		maybeB = () => G.possibly('b')
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	console.log('nullable mid:', JSON.stringify(grammar.parse('ac')))
	console.log('nullable mid2:', JSON.stringify(grammar.parse('abc')))
})

test('Probe: empty input parse', () => {
	class TestGrammar {
		root = () => G.zeroOrMore('a')
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')
	console.log('empty:', JSON.stringify(grammar.parse('')))
})

test('Probe: stringify failing terminal patterns', () => {
	class TestGrammar {
		root = () => [
			'x',
			G.pattern([R.captureAs('foo', R.oneOrMore(R.charRange('a', 'z')))]),
		]
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	try {
		grammar.parse('x1')
	}
	catch (error: any) {
		console.log('pattern terminal error:', error.message)
	}
})

test('Probe: JSON sample2', () => {
	const grammar = G.buildGrammar(JsonGrammar, 'expression', {
		unwrappedNonterminalNames: jsonGrammarUnwrappedNonterminalNames
	})

	const result = grammar.parse(jsonSample2)
	console.log('json2:', JSON.stringify(result, undefined, 2).slice(0, 1500))
})
