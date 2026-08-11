import * as G from '../../exports/Exports.js'

export class SimpleTestGrammar1 {
	root = () => [
		G.anyOf(
			'abc',
			'abcdefg',
		)
	]
}
