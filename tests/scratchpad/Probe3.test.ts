import { test, expect } from 'vitest'

import * as G from '../../src/exports/Exports.js'
import * as R from 'regexp-composer'
import { writeScratchpadOutputToDisk } from '../utilities/Utilities.js'
import { XmlGrammar } from '../../src/tests/test-grammars/XmlGrammar.js'
import { JsonGrammar } from '../../src/tests/test-grammars/JsonGrammar.js'

////////////////////////////////////////////////////////////////////////////
// Agents: scratchpad playground. Do not treat as regression tests.
////////////////////////////////////////////////////////////////////////////

function expectError(run: () => any): G.ParseError {
	try {
		run()
	}
	catch (error: any) {
		return error
	}

	throw new Error('Expected a parse error but parsing succeeded')
}

test('Probe: XML error', () => {
	const grammar = G.buildGrammar(XmlGrammar, 'document')

	const error = expectError(() => grammar.parse(`<hello> wo rld <!!! `))
	expect(error.message, 'XML ERROR').toContain('<<SHOW_ME>>')
})

test('Probe: JSON error', () => {
	const grammar = G.buildGrammar(JsonGrammar, 'expression')

	const error = expectError(() => grammar.parse(`{ "asdf": 12.5 `))
	console.log('JSON error:\n' + error.message)
})

test('Probe: error with multiline input offset', () => {
	const grammar = G.buildGrammar(class {
		root = () => ['a', 'b', 'c']
	}, 'root')

	const error = expectError(() => grammar.parse('a\nbcx'))
	console.log('multiline error:\n' + error.message)
	console.log('line:', error.line, 'column:', error.column, 'offset:', error.offset)
})

test('Probe: error at end of input', () => {
	const grammar = G.buildGrammar(class {
		root = () => ['a', 'b']
	}, 'root')

	const error = expectError(() => grammar.parse('a'))
	console.log('eof error:\n' + error.message)
})

test('Probe: tab handling in error context', () => {
	const grammar = G.buildGrammar(class {
		root = () => ['a', 'b', 'c']
	}, 'root')

	const error = expectError(() => grammar.parse('a\t\tbcx'))
	console.log('tab error:\n' + JSON.stringify(error.message))
})

test('Probe: long line truncation', () => {
	const grammar = G.buildGrammar(class {
		root = () => ['a', 'b', 'c']
	}, 'root')

	const error = expectError(() => grammar.parse('x'.repeat(150) + 'a\ncb'))
	console.log('long-line error:\n' + error.message)
})
