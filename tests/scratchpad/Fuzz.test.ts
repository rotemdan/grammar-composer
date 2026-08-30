import { test, expect } from 'vitest'

import * as G from '../../src/exports/Exports.js'

////////////////////////////////////////////////////////////////////////////
// Agents: scratchpad playground. Do not treat as regression tests.
////////////////////////////////////////////////////////////////////////////

// ---------------------------------------------------------------------------
// Reference PEG interpreter (independent semantics)
// ---------------------------------------------------------------------------
type RElem =
	| { k: 'str', s: string }
	| { k: 'seq', of: RElem[] }
	| { k: 'choice', of: RElem[] }
	| { k: 'opt', of: RElem }
	| { k: 'oneOrMore', of: RElem }
	| { k: 'zeroOrMore', of: RElem }

function refParse(e: RElem, input: string, pos: number): { end: number } | null {
	switch (e.k) {
		case 'str': {
			return input.startsWith(e.s, pos) ? { end: pos + e.s.length } : null
		}

		case 'seq': {
			let p = pos
			for (const m of e.of) {
				const r = refParse(m, input, p)
				if (r === null) {
					return null
				}
				p = r.end
			}
			return { end: p }
		}

		// grammar-composer 'bestOf'-equiv (exhaustive, longest); pick first, longest at ties
		case 'choice': {
			let best: { end: number } | null = null
			for (const m of e.of) {
				const r = refParse(m, input, pos)
				if (r !== null && (best === null || r.end > best.end)) {
					best = r
				}
				if (r !== null && !(e as any).exhaustive) {
					break
				}
			}
			return best
		}

		case 'opt': {
			const r = refParse(e.of, input, pos)
			return r !== null ? r : { end: pos }
		}

		case 'oneOrMore': {
			const first = refParse(e.of, input, pos)
			if (first === null) {
				return null
			}
			let p = first.end
			while (true) {
				const r = refParse(e.of, input, p)
				if (r === null || r.end === p) {
					break
				}
				p = r.end
			}
			return { end: p }
		}

		case 'zeroOrMore': {
			let p = pos
			while (true) {
				const r = refParse(e.of, input, p)
				if (r === null || r.end === p) {
					break
				}
				p = r.end
			}
			return { end: p }
		}
	}
}

// ---------------------------------------------------------------------------
// Random grammar generation, mirrored in both representations
// ---------------------------------------------------------------------------
const terminals = ['a', 'b', 'ab', 'ba']

function mulberry32(seed: number) {
	return function () {
		let t = seed += 0x6D2B79F5
		t = Math.imul(t ^ t >>> 15, t | 1)
		t ^= t + Math.imul(t ^ t >>> 7, t | 61)
		return ((t ^ t >>> 14) >>> 0) / 4294967296
	}
}

interface GenGrammar {
	ref: RElem
	build: () => () => G.Production
}

function generateGrammar(rand: () => number, depth: number, productionRefs: (() => G.Production)[]): GenGrammar {
	const rint = (max: number) => Math.floor(rand() * max)

	if (depth === 0 || rand() < 0.2) {
		const term = terminals[rint(terminals.length)]
		return { ref: { k: 'str', s: term }, build: () => term }
	}

	const kind = rint(6)

	switch (kind) {
		case 0: {
			const members: GenGrammar[] = []
			const count = 2 + rint(3)
			for (let i = 0; i < count; i++) {
				members.push(generateGrammar(rand, depth - 1, productionRefs))
			}
			return {
				ref: { k: 'seq', of: members.map(m => m.ref) },
				build: () => members.map(m => m.build()),
			}
		}

		case 1: {
			const members: GenGrammar[] = []
			const count = 2 + rint(3)
			for (let i = 0; i < count; i++) {
				members.push(generateGrammar(rand, depth - 1, productionRefs))
			}
			const exhaustive = rand() < 0.5
			return {
				ref: { k: 'choice', of: members.map(m => m.ref), exhaustive } as any,
				build: () => exhaustive ? (G as any).bestOf(...members.map(m => m.build())) : (G as any).anyOf(...members.map(m => m.build())),
			}
		}

		case 2: {
			const content = generateGrammar(rand, depth - 1, productionRefs)
			return {
				ref: { k: 'opt', of: content.ref },
				build: () => G.possibly(content.build()),
			}
		}

		case 3: {
			const content = generateGrammar(rand, depth - 1, productionRefs)
			return {
				ref: { k: 'zeroOrMore', of: content.ref },
				build: () => G.zeroOrMore(content.build()),
			}
		}

		case 4: {
			const content = generateGrammar(rand, depth - 1, productionRefs)
			return {
				ref: { k: 'oneOrMore', of: content.ref },
				build: () => G.oneOrMore(content.build()),
			}
		}

		case 5: {
			const content = generateGrammar(rand, depth - 1, productionRefs)
			return {
				ref: content.ref,
				build: () => G.cached(content.build()),
			}
		}

		default: {
			// Reference an already-generated production (if any) or fall back to a terminal
			if (productionRefs.length > 0 && rand() < 0.6) {
				const idx = rint(productionRefs.length)
				const refThunk = productionRefs[idx]
				return { ref: (refThunk as any).__ref as RElem, build: () => refThunk }
			}
			const term = terminals[rint(terminals.length)]
			return { ref: { k: 'str', s: term }, build: () => term }
		}
	}
}

function checkTreeInvariants(input: string, nodes: any[], violations: string[]) {
	for (const node of nodes) {
		const fail = (reason: string) => {
			violations.push(`${reason}: node=${JSON.stringify(node)} input=${JSON.stringify(input)}`)
		}

		if (typeof node.startOffset !== 'number' || typeof node.endOffset !== 'number') {
			fail('missing offsets')
			continue
		}
		if (node.startOffset < 0 || node.endOffset > input.length || node.startOffset > node.endOffset) {
			fail('offsets out of bounds')
		}
		if (node.sourceText !== input.substring(node.startOffset, node.endOffset)) {
			fail('sourceText mismatch')
		}

		if (node.children !== undefined) {
			if (!Array.isArray(node.children)) {
				fail('children not an array')
				continue
			}
			let lastEnd = node.startOffset
			for (const child of node.children) {
				if (child.startOffset < lastEnd) {
					fail(`child start ${child.startOffset} < lastEnd ${lastEnd}`)
				}
				lastEnd = child.endOffset
			}
			if (lastEnd > node.endOffset) {
				fail(`children end ${lastEnd} > parent end ${node.endOffset}`)
			}
			checkTreeInvariants(input, node.children, violations)
		}
	}
}

function fuzzOnce(seed: number): { status: 'build-failed' | 'ok' | 'mismatch' | 'harness-error', message?: string } {
	const rand = mulberry32(seed)

	// Generate a set of productions; some productions reference other productions
	const productionThunks: (() => G.Production)[] = []
	const refs: RElem[] = []

	const productionCount = 3 + Math.floor(rand() * 3)

	for (let i = 0; i < productionCount; i++) {
		const gen = generateGrammar(rand, 3, productionThunks)
		const content = gen.build() as G.Production
		const fn: any = () => content
		productionThunks.push(fn)
		refs[i] = gen.ref
		fn.__ref = gen.ref
	}

	// root production references one of the productions randomly
	const rootIdx = Math.floor(rand() * productionCount)
	const rootThunk = productionThunks[rootIdx]

	const def: any = {}
	const refByThunk = new Map<() => G.Production, RElem>()
	productionThunks.forEach((fn, i) => refByThunk.set(fn, refs[i]))

	const dynGrammar: any = {}
	productionThunks.forEach((fn, i) => {
		dynGrammar[`p${i}`] = fn
	})
	dynGrammar.root = rootThunk

	let grammar
	try {
		grammar = (G as any).buildGrammar(dynGrammar, 'root')
	}
	catch (error) {
		// left recursion / build errors: skip
		return { status: 'build-failed', message: String((error as Error)?.message ?? error) }
	}

	const refRoot = refByThunk.get(rootThunk)!

	const inputs = ['', 'a', 'b', 'ab', 'ba', 'aab', 'aba', 'abb', 'baa', 'abab', 'baba', 'abba', 'baab', 'aabb', 'bbaa', 'abababab', 'babababa', 'baaab', 'abbb', 'aaabbb', 'abbaab', 'aabbaab', 'abbaabba', 'a'.repeat(12), 'b'.repeat(12), 'ab'.repeat(10), 'ba'.repeat(10), 'aab'.repeat(6)]

	for (const input of inputs) {
		try {
			let expected: boolean
			try {
				const r = refParse(refRoot, input, 0)
				expected = r !== null && r.end >= input.length
			}
			catch {
				// reference itself blew up (deep recursion): skip input
				continue
			}

			let actual: boolean
			try {
				const result = grammar.parse(input)
				actual = true

				const violations: string[] = []
				checkTreeInvariants(input, result, violations)

				if (violations.length > 0) {
					return { status: 'mismatch', message: `Tree invariant violation seed=${seed} input=${JSON.stringify(input)}:\n${violations.join('\n')}` }
				}
			}
			catch (error) {
				// valid failure must be a ParseError (not an internal crash)
				const message = (error as Error)?.message ?? String(error)
				if (!message.startsWith('Failed parsing')) {
					return { status: 'harness-error', message: `Non-ParseError thrown seed=${seed} input=${JSON.stringify(input)}: ${message}` }
				}
				actual = false
			}

			if (actual !== expected) {
				return { status: 'mismatch', message: `Mismatch seed=${seed} input=${JSON.stringify(input)} expected=${expected} got=${actual}` }
			}
		}
		catch {
			return { status: 'harness-error', message: `Fuzz harness error seed=${seed} input=${JSON.stringify(input)}` }
		}
	}

	return { status: 'ok' }
}

test('Fuzz: repro single seed', () => {
	for (const seed of [3, 24, 54, 57, 10]) {
		// rebuild the grammar exactly like fuzzOnce does
		const rand = mulberry32(seed)
		const productionThunks: any[] = []
		const productionCount = 3 + Math.floor(rand() * 3)
		for (let i = 0; i < productionCount; i++) {
			const gen = generateGrammar(rand, 3, productionThunks)
			const content = gen.build() as G.Production
			const fn: any = () => content
			productionThunks.push(fn)
			fn.__ref = gen.ref
			fn.content = content
		}
		const rootIdx = Math.floor(rand() * productionCount)
		const refRoot = (productionThunks[rootIdx] as any).__ref

		const dynGrammar: any = {}
		productionThunks.forEach((fn, i) => {
			dynGrammar[`p${i}`] = fn
		})
		dynGrammar.root = productionThunks[rootIdx]

		const grammar = (G as any).buildGrammar(dynGrammar, 'root')

		const describe = (r: any, seen = new Set<any>()): string => {
			if (typeof r === 'string') {
				return JSON.stringify(r)
			}
			if (typeof r === 'function') {
				const idx = productionThunks.indexOf(r)
				return idx >= 0 ? `p${idx}` : `<fn?>`
			}
			if (seen.has(r)) {
				return `<recursion>`
			}
			seen.add(r)
			if (Array.isArray(r)) {
				return `[${r.map(x => describe(x, seen)).join(', ')}]`
			}
			if (r && typeof r === 'object') {
				if ('cached' in r && 'type' in r) {
					const inner =
						'members' in r ? `(${r.members.map((m: any) => describe(m, seen)).join(' | ')})` :
						'content' in r ? `(${describe(r.content, seen)})` : ''
					const kind = r.type === 'Sequence' ? 'seq' : r.type === 'Choice' ? 'choice' : r.type
					return `${kind}${inner}${r.optional ? '?' : ''}${r.exhaustive === false ? '(anyOf)' : r.exhaustive === true ? '(bestOf)' : ''}${r.cached ? '(cached)' : ''}`
				}
				return `{${Object.keys(r).map(k => `${k}: ${describe(r[k], seen)}`).join(', ')}}`
			}
			return String(r)
		}

		const defDump = productionThunks.map(fn => describe(fn.content)).map((d, i) => `p${i} = ${d}`).join('\n')

		// find the failing input and dump details
		const inputs = ['', 'a', 'b', 'ab', 'ba', 'aab']
		for (const input of inputs) {
			const r = refParse(refRoot, input, 0)
			const expected = r !== null && r.end >= input.length
			let actual: any
			let error: any
			try {
				actual = grammar.parse(input)
			}
			catch (e) {
				error = e
			}
			const got = actual !== undefined || error === undefined
			if (got !== expected) {
				expect(`seed=${seed} input=${JSON.stringify(input)}\ndef:\n${defDump}\nrootIdx=${rootIdx}\nref=${JSON.stringify(r)}\nactualResult=${JSON.stringify(actual)}\nerror=${error?.message ?? 'none'}`).toContain('<<SHOW>>')
			}
		}
	}

	expect('no mismatch found in repro').toContain('<<SHOW2>>')
})

test('Fuzz: differential grammar test', () => {
	const mismatches: string[] = []
	let buildsFailed = 0
	let exercised = 0
	const buildErrors = new Map<string, number>()

	for (let seed = 1; seed <= 3000; seed++) {
		const result = fuzzOnce(seed)

		if (result.status === 'build-failed') {
			buildsFailed++
			buildErrors.set(result.message ?? '?', (buildErrors.get(result.message ?? '?') ?? 0) + 1)
			continue
		}

		exercised++

		if (result.status !== 'ok') {
			mismatches.push(result.message ?? result.status)
		}
	}

	console.log(`Seeds: 3000, build-failures: ${buildsFailed}, grammars exercised: ${exercised}, mismatches: ${mismatches.length}`)
	for (const m of mismatches) {
		console.log(m)
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	expect(`buildFailures=${buildsFailed}, exercised=${exercised}\n${[...buildErrors.entries()].map(([k, v]) => `${v}x ${k}`).join('\n')}\nMISMATCHES:\n${mismatches.join('\n')}`).toContain('<<SHOW>>')

	expect(mismatches, mismatches.join('\n')).toEqual([])
})
