import * as G from '../../exports/Exports.js'
import * as R from 'regexp-composer'

export class RegExpGrammar {
	//////////////////////////////////////////////////////////////////////////////////////////////
	// High-level productions
	//////////////////////////////////////////////////////////////////////////////////////////////
	root = () => this.sequenceOrDisjunction

	disjunction = () => [
		this.sequence,

		G.oneOrMore([
			'|',
			this.sequence,
		])
	]

	sequence = () => G.cached(
		G.zeroOrMore(this.sequenceElement)
	)

	sequenceOrDisjunction = [
		G.anyOf(
			this.disjunction,
			this.sequence,
		)
	]

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Quantifier expressions
	//////////////////////////////////////////////////////////////////////////////////////////////
	starQuantifier = () => [
		'*',
		G.possibly(this.nongreedyQuantifier)
	]

	plusQuantifier = () => [
		'+',
		G.possibly(this.nongreedyQuantifier)
	]

	optionalQuantifier = () => [
		'?',
		G.possibly(this.nongreedyQuantifier)
	]

	exactCountQuantifier = () => [
		G.pattern([
			'{',
			R.captureAs('count',
				R.oneOrMore(digit)
			),
			'}',
		]),
		G.possibly(this.nongreedyQuantifier)
	]

	countRangeQuantifier = () => [
		G.pattern([
			'{',
			R.captureAs('start',
				R.oneOrMore(digit)
			),
			',',
			R.possibly(R.captureAs('end',
				R.oneOrMore(digit))
			),
			'}',
		]),
		G.possibly(this.nongreedyQuantifier)
	]

	nongreedyQuantifier = () => '?'

	quantifier = () => G.anyOf(
		this.starQuantifier,
		this.plusQuantifier,
		this.optionalQuantifier,
		this.exactCountQuantifier,
		this.countRangeQuantifier,
	)

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Group expressions
	//////////////////////////////////////////////////////////////////////////////////////////////
	uncapturedGroup = () => [
		'(?:',
		this.sequenceOrDisjunction,
		')',
	]

	namedCaptureGroup = () => [
		'(?<',
		G.pattern(R.captureAs('name',
			R.oneOrMore(identifierChar))
		),
		'>',
		this.sequenceOrDisjunction,
		')',
	]

	unnamedCaptureGroup = () => [
		'(',
		this.sequenceOrDisjunction,
		')',
	]

	group = G.anyOf(
		this.uncapturedGroup,
		this.namedCaptureGroup,
		this.unnamedCaptureGroup,
	)

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Backreferences
	//////////////////////////////////////////////////////////////////////////////////////////////
	unnamedBackreference = () =>
		G.pattern([
			'\\',
			R.captureAs('index',
				digit
			),
		])

	namedBackreference = () =>
		G.pattern([
			'\\k<',
			R.captureAs('name',
				R.oneOrMore(identifierChar)
			),
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
		this.sequenceOrDisjunction,
		')',
	]

	negativeLookahead = () => [
		'(?!',
		this.sequenceOrDisjunction,
		')',
	]

	positiveLookbehind = () => [
		'(?<=',
		this.sequenceOrDisjunction,
		')',
	]

	negativeLookbehind = () => [
		'(?<!',
		this.sequenceOrDisjunction,
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
		this.escapedCharacterClass,
		this.charcodeOrEscapedChar,
		this.unreservedCharLiteral
	)

	unreservedCharLiteral = () => G.pattern(
		R.captureAs('char',
			R.notAnyOfChars('[', '.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', ']', '\\')
		)
	)

	escapedCharLiteral = () => G.pattern([
		'\\',
		R.captureAs('char',
			R.anyChar
		)
	])

	hexCharcode = () =>
		G.pattern([
			'\\x',
			R.captureAs('value',
				R.repeated(2, hexDigit)
			)
		])

	controlCharcode = () => G.pattern([
		'\\c',
		R.captureAs('value',
			R.anyOf(R.charRange('A', 'Z'), R.charRange('a', 'z'))
		)
	])

	nullCharcode = () => G.pattern('\\0')

	codepoint = () => G.anyOf(
		G.pattern([
			'\\u',
			'{',
			R.captureAs('value',
				R.repeated([1, 6], hexDigit)
			),
			'}',
		]),
		G.pattern([
			'\\u',
			R.captureAs('value',
				R.repeated(4, hexDigit)
			)
		])
	)

	codepointRange = () => G.pattern([
		'\\u',
		'{',
		R.captureAs('start',
			R.oneOrMore(hexDigit)
		),
		'-',
		R.captureAs('end',
			R.oneOrMore(hexDigit)
		),
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
		R.captureAs('property',
			R.oneOrMore(R.anyOf(letter, digit, '_', '-'))
		),
		R.possibly([
			'=',
			R.captureAs('value',
				R.oneOrMore(R.anyOf(letter, digit, '_', '-'))
			),
		]),
		'}',
	]

	charClass = () => [
		'[',
		G.possibly(this.charClassNegator),
		G.oneOrMore(G.anyOf(
			this.charRange,
			this.codepointRange,
			this.unicodeProperty,
			this.notUnicodeProperty,
			this.escapedCharacterClass,
			this.charcodeOrEscapedChar,
			this.charClassLiteral
		)),
		']',
	]

	charcodeOrEscapedChar = G.anyOf(
		this.codepoint,
		this.hexCharcode,
		this.controlCharcode,
		this.nullCharcode,
		this.escapedCharLiteral,
	)

	charClassLiteral = () => G.pattern(
		R.captureAs('char',
			R.notAnyOfChars(']')
		)
	)

	charRangeElement = G.anyOf(
		this.charcodeOrEscapedChar,
		this.charClassLiteral,
	)

	charRangeStart = () => this.charRangeElement
	charRangeEnd = () => this.charRangeElement

	charRange = () => [
		this.charRangeStart,
		'-',
		this.charRangeEnd,
	]

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Special symbols
	//////////////////////////////////////////////////////////////////////////////////////////////
	charClassNegator = () => '^'

	inputStartAnchor = () => '^'
	inputEndAnchor = () => '$'

	anyCharWildcard = () => '.'

	anchor = G.anyOf(this.inputStartAnchor, this.inputEndAnchor)

	escapedCharacterClass = () => G.pattern(R.anyOf(
		R.captureAs('whitespace', escapedChars.whitespace),
		R.captureAs('nonWhitespace', escapedChars.nonWhitespace),
		R.captureAs('digit', escapedChars.digit),
		R.captureAs('nonDigit', escapedChars.nonDigit),
		R.captureAs('word', escapedChars.word),
		R.captureAs('nonWord', escapedChars.nonWord),
		R.captureAs('wordBoundary', escapedChars.wordBoundary),
		R.captureAs('nonWordBoundary', escapedChars.nonWordBoundary),
		R.captureAs('formFeed', escapedChars.formFeed),
		R.captureAs('carriageReturn', escapedChars.carriageReturn),
		R.captureAs('lineFeed', escapedChars.lineFeed),
		R.captureAs('tab', escapedChars.tab),
		R.captureAs('verticalTab', escapedChars.verticalTab),
		R.captureAs('backwardSlash', escapedChars.backwardSlash),
	))

	//////////////////////////////////////////////////////////////////////////////////////////////
	// Sequence elements (positioned here due to TypeScript class member ordering requirements)
	//////////////////////////////////////////////////////////////////////////////////////////////
	quantifiableExpression = G.cached(
		G.anyOf(
			this.group,
			this.backReference,
			this.singleCharExpression
		)
	)

	quantifiedExpression = () => [
		this.quantifiableExpression,
		this.quantifier,
	]

	sequenceElement = G.anyOf(
		this.anchor,
		this.lookaround,
		this.quantifiedExpression,
		this.quantifiableExpression,
	)
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Shared regular expressions
//////////////////////////////////////////////////////////////////////////////////////////////
const digit = R.charRange('0', '9')
const letter = R.anyOf(R.charRange('a', 'z'), R.charRange('A', 'Z'))
const hexDigit = R.anyOf(digit, R.charRange('a', 'f'), R.charRange('A', 'F'))
const identifierChar = R.anyOf(letter, digit, '_', '$')

//////////////////////////////////////////////////////////////////////////////////////////////
// Escaped characters lookup
//////////////////////////////////////////////////////////////////////////////////////////////
const escapedChars = {
	whitespace: '\\s',
	nonWhitespace: '\\S',
	digit: '\\d',
	nonDigit: '\\D',
	word: '\\w',
	nonWord: '\\W',
	wordBoundary: '\\b',
	nonWordBoundary: '\\B',
	formFeed: '\\f',
	carriageReturn: '\\r',
	lineFeed: '\\n',
	tab: '\\t',
	verticalTab: '\\v',
	backwardSlash: '\\\\'
}
