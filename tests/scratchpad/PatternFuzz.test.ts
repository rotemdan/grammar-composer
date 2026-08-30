import { describe, expect, test } from 'vitest'

import { buildGrammar, pattern as GPattern } from '../../src/exports/Exports.js'
import * as R from 'regexp-composer'

type Pattern =
	| { k: 'lit', s: string }
	| { k: 'notAnyOf' }
	| { k: 'anyChar' }
	| { k: 'digit' }
	| { k: 'choice', of: Pattern[] }
	| { k: 'opt', of: Pattern }
	| { k: 'star', of: Pattern }
	| { k: 'plus', of: Pattern }
	| { k: 'rep', min: number, max: number | undefined, of: Pattern }
	| { k: 'cap', name?: string, of: Pattern }
	| { k: 'same', ref: string }

interface GenResult {
	node: Pattern
	compile: () => any
}

const literals = ['a', 'b', 'c']
const inputAlphabet = ['a', 'b', 'c']

function mulberry32(seed: number) {
	let a = seed >>> 0
	return () => {
		a |= 0
		a = (a + 0x6D2B79F5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

// Generates a random pattern node. Tracks named groups for valid backreferences.
function compilePattern(node: Pattern): any {
	switch (node.k) {
		case 'lit': {
			return node.s
		}
		case 'notAnyOf': {
			return R.notAnyOfChars('a', 'b')
		}
		case 'anyChar': {
			return R.anyChar
		}
		case 'digit': {
			return R.digit
		}
		case 'choice': {
			return R.anyOf(...node.of.map(compilePattern))
		}
		case 'opt': {
			return R.possibly(compilePattern(node.of))
		}
		case 'star': {
			return R.zeroOrMore(compilePattern(node.of))
		}
		case 'plus': {
			return R.oneOrMore(compilePattern(node.of))
		}
		case 'rep': {
			return node.max === undefined
				? R.repeated(node.min, compilePattern(node.of))
				: R.repeated([node.min, node.max], compilePattern(node.of))
		}
		case 'cap': {
			return node.name === undefined
				? R.capture(compilePattern(node.of))
				: R.captureAs(node.name, compilePattern(node.of))
		}
		case 'same': {
			return R.sameAs(node.ref)
		}
	}
}

// Expected capture-group sequence in index order (i = 1..n): name from captureAs,
// or the textual index for unnamed captures. Mirrors a pre-order walk of the AST,
// which matches how the regex compiler orders groups in the encoded pattern.
interface ExpectedGroup {
	name: string
	nullable: boolean
}

function collectGroups(node: Pattern, expected: ExpectedGroup[], inOptionalContext: boolean) {
	switch (node.k) {
		case 'opt':
		case 'star': {
			collectGroups(node.of, expected, true)
			break
		}
		case 'plus': {
			// oneOrMore content can't itself be skipped, but nested optionalsmark handled recursively
			collectGroups(node.of, expected, inOptionalContext)
			break
		}
		case 'rep': {
			collectGroups(node.of, expected, node.min === 0 ? true : inOptionalContext)
			break
		}
		case 'choice': {
			// If any alternative is nullable, groups may not participate
			for (const member of node.of) {
				collectGroups(member, expected, inOptionalContext)
			}
			break
		}
		case 'cap': {
			expected.push({ name: node.name ?? String(expected.length + 1), nullable: inOptionalContext || isNullable(node.of) })
			collectGroups(node.of, expected, inOptionalContext)
			break
		}
		case 'same': {
			break
		}
		default: {
			break
		}
	}
}

// Conservative "can match empty" (used only for expectations; the actual engine
// decides participation via indices, which is what we compare against)
function isNullable(node: Pattern): boolean {
	switch (node.k) {
		case 'lit':
		case 'notAnyOf':
		case 'anyChar':
		case 'digit':
		case 'same': {
			return false
		}
		case 'opt':
		case 'star': {
			return true
		}
		case 'plus': {
			return isNullable(node.of)
		}
		case 'rep': {
			return node.min === 0 || isNullable(node.of)
		}
		case 'choice': {
			return node.of.some(isNullable)
		}
		case 'cap': {
			return isNullable(node.of)
		}
	}
}

describe('Pattern fuzz: PatternTerminal group mapping', () => {
	test('fuzz pattern grammars', () => {
		const failures: string[] = []
		let exercised = 0

		for (let seed = 1; seed <= 2000; seed++) {
			const rand = mulberry32(seed)
			const namedGroups: string[] = []
			// A pattern must use all-named or all-unnamed captures (validatePatternCaptureGroups)
			const useNamedCaptures = rand() < 0.7

			const genPattern = (depth: number): Pattern => {
				if (depth === 0 || rand() < 0.25) {
					const roll = rand()
					if (roll < 0.7) {
						return { k: 'lit', s: literals[Math.floor(rand() * literals.length)] }
					}
					else if (roll < 0.8) {
						return { k: 'notAnyOf' }
					}
					else if (roll < 0.9) {
						return { k: 'anyChar' }
					}
					return { k: 'digit' }
				}

				const roll = rand()
				if (roll < 0.12) {
					const members: Pattern[] = []
					const count = 2 + Math.floor(rand() * 2)
					for (let i = 0; i < count; i++) {
						members.push(genPattern(depth - 1))
					}
					return { k: 'choice', of: members }
				}
				if (roll < 0.3) {
					return { k: 'opt', of: genPattern(depth - 1) }
				}
				if (roll < 0.45) {
					return { k: 'star', of: genPattern(depth - 1) }
				}
				if (roll < 0.58) {
					return { k: 'plus', of: genPattern(depth - 1) }
				}
				if (roll < 0.66) {
					const min = rand() < 0.5 ? 0 : 1
					const maxPool: (number | undefined)[] = [undefined, 2, 3]
					return { k: 'rep', min, max: maxPool[Math.floor(rand() * maxPool.length)], of: genPattern(depth - 1) }
				}
				if (roll < 0.9) {
					const inner = genPattern(depth - 1)
					if (!useNamedCaptures) {
						return { k: 'cap', of: inner }
					}
					const name = `g${namedGroups.length}`
					namedGroups.push(name)
					return { k: 'cap', name, of: inner }
				}

				// backreference to an existing named group (if any)
				if (useNamedCaptures && namedGroups.length > 0) {
					return { k: 'same', ref: namedGroups[Math.floor(rand() * namedGroups.length)] }
				}
				return { k: 'lit', s: 'a' }
			}

			const elementCount = 1 + Math.floor(rand() * 2)
			const elements: Pattern[] = []
			for (let i = 0; i < elementCount; i++) {
				elements.push(genPattern(3))
			}

			const compiledElements = elements.map(compilePattern)
			const patternArg = compiledElements.length === 1 ? compiledElements[0] : compiledElements

			let wrappedPattern
			try {
				wrappedPattern = GPattern(patternArg as any)
			}
			catch {
				continue // duplicate/invalid group names etc.
			}

			const regExp = wrappedPattern.regExp

			const grammar = buildGrammar({ p: () => wrappedPattern as any }, 'p') as any

			const expectedGroups: ExpectedGroup[] = []
			for (const element of elements) {
				collectGroups(element, expectedGroups, false)
			}

			// random inputs
			const inputs = ['', 'a', 'b', 'c', 'abc', 'acb', 'bac', 'aab', 'abccba', 'aaa', 'ccc', 'abca', 'abcabc', 'aaabbbccc']
			for (let i = 0; i < 4; i++) {
				const len = Math.floor(rand() * 7)
				let s = ''
				for (let j = 0; j < len; j++) {
					s += inputAlphabet[Math.floor(rand() * inputAlphabet.length)]
				}
				inputs.push(s)
			}

			exercised++

			for (const input of inputs) {
				let match: any
				try {
					match = regExp.exec(input)
				}
				catch (e) {
					failures.push(`Seed=${seed} exec threw: ${(e as Error).message}`)
					break
				}

				const expectedAccept = match !== null && match[0].length === input.length

				let actualNodes: any
				let threw = false
				try {
					actualNodes = grammar.parse(input)
				}
				catch {
					threw = true
				}

				if (expectedAccept === threw) {
					if (failures.length < 5) {
						failures.push(`Seed=${seed} input=${JSON.stringify(input)}: expectedAccept=${expectedAccept} threw=${threw} match=${JSON.stringify(match)}`)
					}
					break
				}

				if (!expectedAccept) {
					continue
				}

				// grammar node structure: root nonterminal containing the group nodes
				const rootNodes = actualNodes as any[]
				const rootNode = rootNodes[0]
				const children = rootNode?.children ?? []

				// Compute expected nodes from the regex indices
				const indices: (number[] | undefined)[] = (match as any).indices
				const expectedNodes: any[] = []
				for (let i = 1; i < indices.length; i++) {
					const range = indices[i]
					if (range === undefined) {
						continue
					}
					const expectedName = expectedGroups[i - 1]?.name ?? String(i)
					expectedNodes.push({
						name: expectedName,
						startOffset: range[0],
						endOffset: range[1],
						sourceText: input.substring(range[0], range[1]),
					})
				}

				if (children.length !== expectedNodes.length) {
					if (failures.length < 5) {
						failures.push(`Seed=${seed} input=${JSON.stringify(input)}: node count ${children.length} != expected ${expectedNodes.length}\nactual=${JSON.stringify(children)}\nexpected=${JSON.stringify(expectedNodes)}\ngroups=${JSON.stringify(indices)}`)
					}
					break
				}

				for (let i = 0; i < expectedNodes.length; i++) {
					const actual = children[i]
					const expected = expectedNodes[i]
					if (actual.name !== expected.name || actual.startOffset !== expected.startOffset || actual.endOffset !== expected.endOffset || actual.sourceText !== expected.sourceText) {
						if (failures.length < 5) {
							failures.push(`Seed=${seed} input=${JSON.stringify(input)}: node ${i} mismatch\nactual=${JSON.stringify(actual)}\nexpected=${JSON.stringify(expected)}\ngroups=${JSON.stringify(indices)}`)
						}
					}
				}
			}
		}

		expect(`exercised=${exercised}\n${failures.join('\n---\n')}`).toContain('<<SHOW>>')
		expect(failures, failures.join('\n---\n')).toEqual([])
	})
})
