import * as G from '../GrammarComposer.js'
import * as R from 'regexp-composer'

export class RegExpGrammar {
	//////////////////////////////////////////////////////////////////////////////////////////////
	// High level productions
	//////////////////////////////////////////////////////////////////////////////////////////////
	disjunction = () => [
		this.sequence,

		G.possibly([
			this.disjunctionSeparator,
			this.disjunction,
		])
	]

	sequence = () => G.oneOrMore(this.element)

	element = () => G.anyOf(
		this.anchor,
		this.lookaround,
		this.possiblyQuantifiedExpression,
	)

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Quantifed expressions
	//////////////////////////////////////////////////////////////////////////////////////////////
	possiblyQuantifiedExpression = () => [
		G.anyOf(
			this.group,
			this.backReference,
			this.singleCharExpression
		),

		G.possibly(G.anyOf(
			this.starQuantifier,
			this.plusQuantifier,
			this.exactCountQuantifier,
			this.countRangeQuantifier,
		)),

		G.possibly(this.nongreedyQuantifier), // Nongreedy quantifier
	]

	exactCountQuantifier = () => G.pattern([
		'{',
		R.captureAs('count', R.oneOrMore(digit)),
		'}',
	])

	countRangeQuantifier = () => G.pattern([
		'{',
		R.captureAs('start', R.oneOrMore(digit)),
		',',
		R.possibly(R.captureAs('end', R.oneOrMore(digit))),
		'}',
	])

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Group expressions
	//////////////////////////////////////////////////////////////////////////////////////////////
	group = () => G.anyOf(
		this.uncapturedGroup,
		this.namedCaptureGroup,
		this.unnamedCaptureGroup,
	)

	uncapturedGroup = () => [
		'(:',
		this.disjunction,
		')',
	]

	namedCaptureGroup = () => [
		'(?<',
		G.pattern(R.captureAs('name', R.oneOrMore(letter))),
		'>',
		this.disjunction,
		')',
	]

	unnamedCaptureGroup = () => [
		'(',
		this.disjunction,
		')',
	]

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Backreferences
	//////////////////////////////////////////////////////////////////////////////////////////////
	unnamedBackreference = () =>
		G.pattern([
			'\\',
			R.captureAs('index', digit),
		])

	namedBackreference = () =>
		G.pattern([
			'\\k<',
			R.captureAs('name', digit),
			'>',
		])

	backReference = G.anyOf(
		this.unnamedBackreference,
		this.namedBackreference,
	)

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Lookahead and lookbehind expressions
	//////////////////////////////////////////////////////////////////////////////////////////////
	positiveLookahead = () => [
		'(?=',
		this.disjunction,
		')',
	]

	negativeLookahead = () => [
		'(?!',
		this.disjunction,
		')',
	]

	positiveLookbehind = () => [
		'(?<=',
		this.disjunction,
		')',
	]

	negativeLookbehind = () => [
		'(?<!',
		this.disjunction,
		')',
	]

	lookaround = G.anyOf(
		this.positiveLookahead,
		this.negativeLookahead,
		this.positiveLookbehind,
		this.negativeLookbehind,
	)

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Single character expressions
	//////////////////////////////////////////////////////////////////////////////////////////////
	singleCharExpression = () => G.anyOf(
		this.anyCharWildcard,
		this.charClass,
		this.unicodeProperty,
		this.notUnicodeProperty,
		this.charcodeOrEscapedChar,
		this.unreservedCharLiteral
	)

	unreservedCharLiteral = () => G.pattern(
		R.notAnyOfChars('[', '.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', ']', '\\')
	)

	escapedCharLiteral = () => G.pattern([
		'\\',
		R.anyChar
	])

	hexCharcode = () =>
		G.pattern([
			'\\x',
			hexDigit,
			hexDigit
		])

	controlCharcode = () => G.pattern([
		'\\c',
		R.charRange('A', 'Z'),
	])

	codepoint = () => G.pattern([
		'\\u',
		'{',
		R.captureAs('value', R.oneOrMore(hexDigit)),
		'}',
	])

	codepointRange = () => G.pattern([
		'\\u',
		'{',
		R.captureAs('start', R.oneOrMore(hexDigit)),
		'-',
		R.captureAs('end', R.oneOrMore(hexDigit)),
		'}',
	])

	unicodeProperty = () => G.pattern([
		'\\p',
		this.unicodePropertyBodyPattern,
	])

	notUnicodeProperty = () => G.pattern([
		'\\P',
		this.unicodePropertyBodyPattern,
	])

	unicodePropertyBodyPattern: R.Pattern = [
		'{',
		R.captureAs('property', R.oneOrMore(letterOrDigit)),
		R.possibly([
			'=',
			R.captureAs('value', R.oneOrMore(letterOrDigit)),
		]),
		'}',
	]

	charClassChar = () => G.pattern(R.notAnyOfChars(']'))

	charClass = () => [
		'[',
		G.possibly(this.charClassNegator),
		G.oneOrMore(G.anyOf(
			this.charRange,
			this.codepointRange,
			this.charClass,
			this.unicodeProperty,
			this.notUnicodeProperty,
			this.charcodeOrEscapedChar,
			this.charClassChar
		)),
		']',
	]

	charcodeOrEscapedChar = G.anyOf(
		this.codepoint,
		this.hexCharcode,
		this.controlCharcode,
		this.escapedCharLiteral,
	)

	charRangeElement = G.anyOf(
		this.charcodeOrEscapedChar,
		G.pattern(R.anyChar),
	)

	charRange = () => [
		this.charRangeElement,
		'-',
		this.charRangeElement,
	]

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Special symbols
	//////////////////////////////////////////////////////////////////////////////////////////////
	starQuantifier = () => '*'
	plusQuantifier = () => '+'
	nongreedyQuantifier = () => '?'

	charClassNegator = () => '^'

	inputStartAnchor = () => '^'
	inputEndAnchor = () => '$'

	anyCharWildcard = () => '.'

	disjunctionSeparator = () => '|'

	anchor = G.anyOf(this.inputStartAnchor, this.inputEndAnchor)

	escapedCharacterClass = () => G.pattern(R.anyOf(
		R.captureAs('whitespace', escapedCharString.whitespace),
		R.captureAs('nonWhitespace', escapedCharString.nonWhitespace),
		R.captureAs('digit', escapedCharString.digit),
		R.captureAs('nonDigit', escapedCharString.nonDigit),
		R.captureAs('wordBoundary', escapedCharString.wordBoundary),
		R.captureAs('nonWordBoundary', escapedCharString.nonWordBoundary),
		R.captureAs('formFeed', escapedCharString.formFeed),
		R.captureAs('carriageReturn', escapedCharString.carriageReturn),
		R.captureAs('lineFeed', escapedCharString.lineFeed),
		R.captureAs('tab', escapedCharString.tab),
		R.captureAs('verticalTab', escapedCharString.verticalTab),
		R.captureAs('backwardSlash', escapedCharString.backwardSlash),
	))
}

const digit = R.charRange('0', '9')
const letter = R.anyOf(R.charRange('a', 'z'), R.charRange('A', 'Z'))
const letterOrDigit = R.anyOf(letter, digit)
const hexDigit = R.anyOf(digit, R.charRange('a', 'f'), R.charRange('A', 'F'))

const escapedCharString = {
	whitespace: '\\s',
	nonWhitespace: '\\S',
	digit: '\\d',
	nonDigit: '\\D',
	word: '\\d',
	nonWord: '\\D',
	wordBoundary: '\\b',
	nonWordBoundary: '\\B',
	formFeed: '\\f',
	carriageReturn: '\\r',
	lineFeed: '\\n',
	tab: '\\t',
	verticalTab: '\\v',
	backwardSlash: '\\\\'
}
