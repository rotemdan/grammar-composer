import { describe, expect, test } from 'vitest'

import { buildGrammar, possibly } from '../../src/exports/Exports.js'
import { JsonGrammar, jsonGrammarUnwrappedNonterminalNames } from '../../src/tests/test-grammars/JsonGrammar.js'
import { XmlGrammar, xmlGrammarUnwrappedNonterminalNames } from '../../src/tests/test-grammars/XmlGrammar.js'
import { RegExpGrammar, regExpGrammarUnwrappedNonterminalNames } from '../../src/tests/test-grammars/RegExpGrammar.js'
import { jsonSample1, jsonSample2 } from '../../src/tests/test-data/TestData.js'
import { SimpleTestGrammar1 } from '../../src/tests/test-grammars/SimpleTestGrammar1.js'
import type { ParseTreeNode } from '../../src/parser/Parser.js'

function checkTreeInvariants(input: string, nodes: ParseTreeNode[], path = '', violations: string[] = []) {
	for (const node of nodes) {
		const nodePath = `${path}/${node.name}`

		const fail = (reason: string) => {
			violations.push(`${reason}: ${nodePath} node=${JSON.stringify(node)} input=${JSON.stringify(input)}`)
		}

		// Node offsets must be ordered and within input bounds
		if (node.startOffset > node.endOffset) {
			fail('startOffset > endOffset')
		}
		if (node.startOffset < 0 || node.endOffset > input.length) {
			fail('offset out of bounds')
		}

		// sourceText must be the exact input slice
		if (node.sourceText !== input.substring(node.startOffset, node.endOffset)) {
			fail('sourceText mismatch')
		}

		// NOTE: empty nodes are legitimate for zero-width capture groups
		// (e.g. the JSON grammar's stringLiteral capturing an empty string value)

		if (node.children !== undefined) {
			// children must be contiguous and inside the parent
			let lastEnd = node.startOffset
			for (const child of node.children) {
				if (child.startOffset < lastEnd) {
					fail(`nested child start ${child.startOffset} < lastEnd ${lastEnd}`)
				}
				lastEnd = child.endOffset
			}
			if (lastEnd > node.endOffset) {
				fail(`nested children end ${lastEnd} > parent end ${node.endOffset}`)
			}

			checkTreeInvariants(input, node.children, nodePath, violations)
		}
	}

	return violations
}

describe('regression: library grammars after optional-skip fix', () => {
	test('JSON grammar parses sample documents', () => {
		const grammar = buildGrammar(JsonGrammar, 'expression', {
			unwrappedNonterminalNames: jsonGrammarUnwrappedNonterminalNames
		})

		for (const jsonString of [jsonSample1, jsonSample2]) {
			const result = grammar.parse(jsonString) as ParseTreeNode[]
			expect(result.length).toBeGreaterThan(0)
			const violations = checkTreeInvariants(jsonString, result)
			expect(violations.join('\n'), `input=${JSON.stringify(jsonString)}`).toEqual('')
		}
	})

	test('XML grammar parses sample document', () => {
		const xmlString = `
<!DOCTYPE web-app>

<menu>
    <header>Adobe SVG Viewer</header>
    <item action="Open" id="Open">Open</item>
    <item action="OpenNew" id="OpenNew">Open New</item>
</menu>
`
		const grammar = buildGrammar(XmlGrammar, 'document', {
			unwrappedNonterminalNames: xmlGrammarUnwrappedNonterminalNames
		})

		const result = grammar.parse(xmlString) as ParseTreeNode[]
		expect(result.length).toBeGreaterThan(0)
		const violations = checkTreeInvariants(xmlString, result)
		expect(violations.join('\n'), `input=${JSON.stringify(xmlString)}`).toEqual('')
	})

	test('RegExp grammar parses regex source', () => {
		const regExpString = /^(abcd)*ef+g/.source

		const grammar = buildGrammar(RegExpGrammar, 'root', {
			unwrappedNonterminalNames: regExpGrammarUnwrappedNonterminalNames
		})

		const result = grammar.parse(regExpString) as ParseTreeNode[]
		expect(result.length).toBeGreaterThan(0)
		const violations = checkTreeInvariants(regExpString, result)
		expect(violations.join('\n'), `input=${JSON.stringify(regExpString)}`).toEqual('')
	})

	test('SimpleTestGrammar1 committed-choice semantics', () => {
		const grammar = buildGrammar(SimpleTestGrammar1, 'root')

		// First anyOf member 'abc' matches and is accepted without trying later members
		const result = grammar.parse('abc') as ParseTreeNode[]
		expect(result.length).toBeGreaterThan(0)
		const violations = checkTreeInvariants('abc', result)
		expect(violations.join('\n'), `input=${JSON.stringify('abc')}`).toEqual('')

		// Input that continues past the first accepted match can't be fully consumed
		expect(() => grammar.parse('abcdefg')).toThrow(/3 of 7 characters consumed/)
	})

	test('possibly at root accepts empty input', () => {
		const grammar = buildGrammar({
			p: () => possibly('b')
		}, 'p') as any

		expect(grammar.parse('')).toEqual([])
		expect((grammar.parse('b') as any[]).length).toBeGreaterThan(0)
	})

	test('possibly of nonterminal at root accepts empty input and non-matching input', () => {
		class G1 {
			p = () => possibly(this.q)
			q = () => 'abc'
		}

		const grammar = buildGrammar(G1, 'p') as any

		expect(grammar.parse('')).toEqual([])
		expect((grammar.parse('abc') as any[]).length).toBeGreaterThan(0)
		expect(() => grammar.parse('x')).toThrow()
	})

	test('possibly as sequence member skips when it does not match', () => {
		class G1 {
			p = () => [possibly('ab'), 'q']
		}

		const grammar = buildGrammar(G1, 'p') as any

		// skips and proceeds to 'q'
		const result = grammar.parse('q') as ParseTreeNode[]
		expect(result.length).toBeGreaterThan(0)
		checkTreeInvariants('q', result)
	})
})
