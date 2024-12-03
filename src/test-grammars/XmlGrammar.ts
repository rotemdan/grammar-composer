import * as G from "../GrammarComposer.js"
import * as R from 'regexp-composer'

export class XmlGrammar {
	document = () => [
		G.zeroOrMore(
			G.anyOf(
				this.textFragment,
				this.openingTag,
				this.closingTag,
				this.comment,
				this.declarationTag,
			)
		)
	]

	textFragment = G.pattern([
		R.oneOrMore(R.notAnyOfChars('<'))
	])

	openingTag = () => [
		this.openingTagStart,

		G.zeroOrMore(this.attribute),

		this.tagEnd
	]

	openingTagStart = G.pattern([
		'<',

		R.possibly('?'),

		R.captureAs('tagName',
			R.oneOrMore(R.notAnyOfChars(R.whitespace, '"', "'", '?', '!', '/', '>'))
		),

		R.zeroOrMore(R.whitespace),
	])

	tagEnd = G.pattern([
		R.zeroOrMore(R.whitespace),

		R.possibly(R.anyOf('/', '?')),

		'>'
	])

	attribute = G.pattern([
		R.zeroOrMore(R.whitespace),

		R.captureAs('attributeName',
			R.oneOrMore(R.notAnyOfChars(R.whitespace, '=', '"', "'", '?', '/', '>'))
		),

		R.zeroOrMore(R.whitespace),

		R.possibly([
			'=',

			R.zeroOrMore(R.whitespace),

			quotedString,

			R.zeroOrMore(R.whitespace),
		])
	])

	closingTag = G.pattern([
		'</',

		R.zeroOrMore(R.whitespace),

		R.captureAs('tagName',
			R.oneOrMore(R.notAnyOfChars(R.whitespace, '/', '>'))
		),

		R.zeroOrMore(R.whitespace),

		'>'
	])

	declarationTag = () => [
		this.declarationTagOpening,

		G.zeroOrMore(this.declarationTagAttribute),

		this.tagEnd
	]

	declarationTagOpening = G.pattern([
		'<!',

		R.captureAs('tagName',
			R.oneOrMore(R.notAnyOfChars(R.whitespace, '"', "'", '/', '>'))
		),

		R.zeroOrMore(R.whitespace)
	])

	declarationTagAttribute = G.pattern([
		R.zeroOrMore(R.whitespace),

		R.anyOf(
			R.captureAs('attributeName',
				R.oneOrMore(R.notAnyOfChars(R.whitespace, '"', "'", '/', '!', '?', '>'))
			),

			quotedString,
		),

		R.zeroOrMore(R.whitespace),
	])

	comment = G.pattern([
		'<!--',

		R.captureAs('commentBody',
			R.zeroOrMoreNonGreedy(R.anyChar)
		),

		'-->'
	])
}

const quotedString = R.anyOf(
	[
		'"',
		R.captureAs('doubleQuotedStringContent',
			R.zeroOrMore(R.notAnyOfChars('"'))
		),
		'"'
	],
	[
		"'",
		R.captureAs('singleQuotedStringContent',
			R.zeroOrMore(R.notAnyOfChars("'"))
		),
		"'"
	],
)
