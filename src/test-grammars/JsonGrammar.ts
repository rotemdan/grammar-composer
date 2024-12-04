import * as G from "../GrammarComposer.js"
import * as R from 'regexp-composer'

export class JsonGrammar {
	expression = () => G.anyOf(
		this.stringLiteral,
		this.numberLiteral,
		this.booleanLiteral,
		this.nullLiteral,
		this.objectExpression,
		this.arrayExpression
	)

	stringLiteral = G.pattern([
		zeroOrMoreWhitespace,

		'"',

		R.captureAs('value',
			R.zeroOrMoreNonGreedy(R.anyChar)
		),

		R.matches('"', {
			ifNotPrecededBy: '\\'
		}),

		zeroOrMoreWhitespace,
	])

	numberLiteral = G.pattern([
		zeroOrMoreWhitespace,

		R.captureAs('value', [
			R.possibly('-'), // Sign
			R.anyOf(
				'0', // Zero only
				[
					R.charRange('1', '9'), // First digit
					R.zeroOrMore(R.digit), // Next digits
				]
			),
			R.possibly(['.', R.oneOrMore(R.digit)]), // Decimal value
			R.possibly([R.anyOf('e', 'E'), R.anyOf('+', '-'), R.oneOrMore(R.digit)]), // Exponent
		]),

		zeroOrMoreWhitespace,
	])

	booleanLiteral = G.pattern([
		zeroOrMoreWhitespace,

		R.captureAs('value',
			R.anyOf('true', 'false')
		),

		zeroOrMoreWhitespace,
	])

	nullLiteral = G.pattern([
		zeroOrMoreWhitespace,

		'null',

		zeroOrMoreWhitespace,
	])

	objectExpression = () => [
		this.openingCurlyBrace,

		G.possibly([
			this.objectPropertyExpression,
			G.zeroOrMore([this.comma, this.objectPropertyExpression])
		]),

		this.closingCurlyBrace,
	]

	objectPropertyExpression = () => [
		this.stringLiteral,
		this.colons,
		this.expression,
	]

	arrayExpression = () => [
		this.openingSquareBracket,

		G.possibly([
			this.expression,
			G.zeroOrMore([this.comma, this.expression])
		]),

		this.closingSquareBracket
	]

	openingCurlyBrace = createPatternWithClearedWhitespace('{')
	closingCurlyBrace = createPatternWithClearedWhitespace('}')

	openingSquareBracket = createPatternWithClearedWhitespace('[')
	closingSquareBracket = createPatternWithClearedWhitespace(']')

	comma = createPatternWithClearedWhitespace(',')
	colons = createPatternWithClearedWhitespace(':')
}

function createPatternWithClearedWhitespace(subpattern: R.Pattern) {
	return G.pattern([
		zeroOrMoreWhitespace,

		subpattern,

		zeroOrMoreWhitespace
	])
}

const zeroOrMoreWhitespace = R.zeroOrMore(R.whitespace)
