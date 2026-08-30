import { test, expect } from 'vitest'

import * as G from '../../src/exports/Exports.js'
import * as R from 'regexp-composer'

////////////////////////////////////////////////////////////////////////////
// Agents: scratchpad playground. Do not treat as regression tests.
////////////////////////////////////////////////////////////////////////////

test('RegExp engine identity check for hasIndices groups', () => {
	const re = /(?<a>x)(?<b>y)?/d
	const m: any = re.exec('x')! // b doesn't participate
	console.log('m:', JSON.stringify(m))
	console.log('identity groups.a === indices[1]:', (m as any).indices.groups.a === (m as any).indices[1])
	console.log('groups.b:', (m as any).indices.groups.b, 'indices[2]:', (m as any).indices[2])
})

test('Probe: full named-group tree names/sizes', () => {
	class TestGrammar {
		root = () => G.pattern([
			R.captureAs('a', [
				R.captureAs('b', 'x'),
				'y',
			]),
			R.possibly(R.captureAs('c', 'q')),
			R.captureAs('d', R.oneOrMore(R.digit)),
		])
	}

	const grammar = G.buildGrammar(TestGrammar, 'root')

	const tree = (text: string) => (grammar.parse(text) as any[]).map((n: any) => `${n.name}[${n.startOffset},${n.endOffset}]:${n.sourceText}`).join(', ')

	console.log('xyq12 ->', tree('xyq12'))
	console.log('xy12  ->', tree('xy12'))
	console.log('full ->', JSON.stringify(grammar.parse('xyq12'), undefined, 2))
	expect(JSON.stringify(grammar.parse('xyq12'))).toContain('<<SHOW>>')
})
