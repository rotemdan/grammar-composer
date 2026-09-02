# Grammar composer

A library to define, build and efficiently parse context-free grammars.

* Grammars are defined using TypeScript class declarations
* No tokenization stage. The generated parser accepts raw characters as input, meaning it's a form of lexer-free, hybrid parser, supporting contextual low-level parsing. This means low-level character patterns, recognized by a regular language, can be specialized to various high-level parser contexts, and sub-patterns captured in low-level regular expressions are directly embedded as part of the resulting parse tree
* Raw character parsing is defined as part of the grammar via embedded `Pattern` objects that are internally processed through the [`regexp-composer`](https://github.com/rotemdan/regexp-composer) regular expression library. This means that any subset of the grammar that can be stated as a regular grammar can be moved to be parsed using the highly optimized native JavaScript RegExp engine, instead of being parsed via the slower context-free parser
* Top-down parsing (roughly equivalent to PEG parsing), with optional "packrat" caching that can be enabled or disabled for individual productions or more specific grammar expressions
* Supports right-recursion, but will currently error when left-recursion is detected
* Uses sophisticated static analysis to automatically identify and annotate optional productions
* Provides useful parse-time error reporting, identifying the exact production involved and most likely alternatives at the failed position

## Installation

```
npm install grammar-composer
```

And also the related regular expression builder package:
```
npm install regexp-composer
```

## Example: XML grammar

The grammar is defined within a container class `XmlGrammar`. It contains a mixture of higher-level, context-free productions and lower-level, regular expression productions.

* Context-free grammar productions are defined by anonymous functions `() => ...`
* Regular expression productions are defined by `() => pattern(...)`

(Note: since version `0.5.0` all class members must be productions like `() => ...`, otherwise the grammar would cause a build error)

In this example, context-free operators are prefixed with `G`, and regular expression operators are prefixed with `R`, to avoid confusion between similarly named operators:

```ts
import * as G from '../../exports/Exports.js'
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

	textFragment = () => G.pattern([
		R.oneOrMore(R.notAnyOfChars('<'))
	])

	openingTag = () => [
		this.openingTagStart,

		G.zeroOrMore(this.attribute),

		this.tagEnd
	]

	openingTagStart = () => G.pattern([
		'<',

		R.possibly('?'),

		R.captureAs('tagName',
			R.oneOrMore(R.notAnyOfChars(R.whitespace, '"', "'", '?', '!', '/', '>'))
		),

		R.zeroOrMore(R.whitespace),
	])

	tagEnd = () => G.pattern([
		R.zeroOrMore(R.whitespace),

		R.possibly(R.anyOf('/', '?')),

		'>'
	])

	attribute = () => G.pattern([
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

	closingTag = () => G.pattern([
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

	declarationTagOpening = () => G.pattern([
		'<!',

		R.captureAs('tagName',
			R.oneOrMore(R.notAnyOfChars(R.whitespace, '"', "'", '/', '>'))
		),

		R.zeroOrMore(R.whitespace)
	])

	declarationTagAttribute = () => G.pattern([
		R.zeroOrMore(R.whitespace),

		R.anyOf(
			R.captureAs('attributeName',
				R.oneOrMore(R.notAnyOfChars(R.whitespace, '"', "'", '/', '!', '?', '>'))
			),

			quotedString,
		),

		R.zeroOrMore(R.whitespace),
	])

	comment = () => G.pattern([
		'<!--',

		R.captureAs('commentBody',
			R.zeroOrMoreNonGreedy(R.anyChar)
		),

		'-->'
	])
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Helper regular expressions
//////////////////////////////////////////////////////////////////////////////////////////////
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

//////////////////////////////////////////////////////////////////////////////////////////////
// Unfolded nonterminal list
//
// Nonterminals placed here will be "transparent" in the resulting parse tree.
//
// Their content would be absorbed by their parent.
//
// This is useful for the purpose of simplifying the resulting parse tree, and
// removing non-semantic "technical" nodes used for things like grammar optimization
// and refactoring.
//////////////////////////////////////////////////////////////////////////////////////////////
export const xmlGrammarUnfoldedNonterminalNames: G.GrammarNonterminalNames<XmlGrammar> = [
	'openingTagStart',
	'tagEnd',
	'declarationTagOpening',
]
```

### Building and parsing using the XML grammar

```ts
import { buildGrammar } from 'grammar-composer'
import { XmlGrammar, xmlGrammarUnfoldedNonterminalNames } from './XmlGrammar.js'

	const xmlString = `
<!DOCTYPE web-app>

<menu>
    <header>Adobe SVG Viewer</header>
    <item action="Open" id="Open">Open</item>
    <item action="OpenNew" id="OpenNew">Open New</item>
</menu>
`

// Build the grammar. 'document' is the starting production.
//
// Although `XmlGrammar` is defined as a class, there's no need to instantiate it,
// just pass it as it is.
const grammar = buildGrammar(RegExpGrammar, 'root', {
    // This list contains the names of Nonterminals that would be
    // "passed through" when the parse tree is built,
    // meaning they would not appear in the parse tree
    // and their child nodes would be absorbed into their ancestor nodes.
    unfoldedNonterminalNames: xmlGrammarUnfoldedNonterminalNames
})

// Parse the XML string with the built grammar
const parseTree = grammar.parse(xmlString)
```

The resulting parse tree looks like:

```ts
[
    {
        "name": "document",
        "startOffset": 0,
        "endOffset": 177,
        "sourceText": "\n<!DOCTYPE web-app>\n\n<menu>\n    <header>Adobe SVG Viewer</header>\n    <item action=\"Open\" id=\"Open\">Open</item>\n    <item action=\"OpenNew\" id=\"OpenNew\">Open New</item>\n</menu>\n\n",
        "children": [
            {
                "name": "textFragment",
                "startOffset": 0,
                "endOffset": 1,
                "sourceText": "\n",
                "children": []
            },
            {
                "name": "declarationTag",
                "startOffset": 1,
                "endOffset": 19,
                "sourceText": "<!DOCTYPE web-app>",
                "children": [
                    {
                        "name": "tagName",
                        "startOffset": 3,
                        "endOffset": 10,
                        "sourceText": "DOCTYPE"
                    },
                    {
                        "name": "declarationTagAttribute",
                        "startOffset": 11,
                        "endOffset": 18,
                        "sourceText": "web-app",
                        "children": [
                            {
                                "name": "attributeName",
                                "startOffset": 11,
                                "endOffset": 18,
                                "sourceText": "web-app"
                            }
                        ]
                    }
                ]
            },
            {
                "name": "textFragment",
                "startOffset": 19,
                "endOffset": 21,
                "sourceText": "\n\n",
                "children": []
            },
            {
                "name": "openingTag",
                "startOffset": 21,
                "endOffset": 27,
                "sourceText": "<menu>",
                "children": [
                    {
                        "name": "tagName",
                        "startOffset": 22,
                        "endOffset": 26,
                        "sourceText": "menu"
                    }
                ]
            },
            {
                "name": "textFragment",
                "startOffset": 27,
                "endOffset": 32,
                "sourceText": "\n    ",
                "children": []
            },
            {
                "name": "openingTag",
                "startOffset": 32,
                "endOffset": 40,
                "sourceText": "<header>",
                "children": [
                    {
                        "name": "tagName",
                        "startOffset": 33,
                        "endOffset": 39,
                        "sourceText": "header"
                    }
                ]
            },
            {
                "name": "textFragment",
                "startOffset": 40,
                "endOffset": 56,
                "sourceText": "Adobe SVG Viewer",
                "children": []
            },
            {
                "name": "closingTag",
                "startOffset": 56,
                "endOffset": 65,
                "sourceText": "</header>",
                "children": [
                    {
                        "name": "tagName",
                        "startOffset": 58,
                        "endOffset": 64,
                        "sourceText": "header"
                    }
                ]
            },
            {
                "name": "textFragment",
                "startOffset": 65,
                "endOffset": 70,
                "sourceText": "\n    ",
                "children": []
            },
            {
                "name": "openingTag",
                "startOffset": 70,
                "endOffset": 100,
                "sourceText": "<item action=\"Open\" id=\"Open\">",
                "children": [
                    {
                        "name": "tagName",
                        "startOffset": 71,
                        "endOffset": 75,
                        "sourceText": "item"
                    },
                    {
                        "name": "attribute",
                        "startOffset": 76,
                        "endOffset": 90,
                        "sourceText": "action=\"Open\" ",
                        "children": [
                            {
                                "name": "attributeName",
                                "startOffset": 76,
                                "endOffset": 82,
                                "sourceText": "action"
                            },
                            {
                                "name": "doubleQuotedStringContent",
                                "startOffset": 84,
                                "endOffset": 88,
                                "sourceText": "Open"
                            }
                        ]
                    },
                    {
                        "name": "attribute",
                        "startOffset": 90,
                        "endOffset": 99,
                        "sourceText": "id=\"Open\"",
                        "children": [
                            {
                                "name": "attributeName",
                                "startOffset": 90,
                                "endOffset": 92,
                                "sourceText": "id"
                            },
                            {
                                "name": "doubleQuotedStringContent",
                                "startOffset": 94,
                                "endOffset": 98,
                                "sourceText": "Open"
                            }
                        ]
                    }
                ]
            },
            {
                "name": "textFragment",
                "startOffset": 100,
                "endOffset": 104,
                "sourceText": "Open",
                "children": []
            },
            {
                "name": "closingTag",
                "startOffset": 104,
                "endOffset": 111,
                "sourceText": "</item>",
                "children": [
                    {
                        "name": "tagName",
                        "startOffset": 106,
                        "endOffset": 110,
                        "sourceText": "item"
                    }
                ]
            },
...
```

## Operators

Context-free operators are mostly named similarly to the ones in [`regexp-composer`](https://github.com/rotemdan/regexp-composer).

### `zeroOrMore(grammarExpression)`

Match the grammar expression zero or more times.

### `oneOrMore(grammarExpression)`

Match the grammar expression one or more times.

### `anyOf(grammarExpression1, grammarExpression2, grammarExpression3, ...)`

Match any of the grammar expressions. The first successful match, in order, would be accepted without trying subsequent ones.

### `bestOf(grammarExpression1, grammarExpression2, grammarExpression3, ...)`

Match the best grammar expression. All possibilities would be tried, and the the longest match (in terms of character count) would be chosen.

### `possibly(grammarExpression)`

Optionally accept the grammar expression, or skip if it doesn't match.

### `pattern(regexpPattern)`

Accept a regular expression pattern compatible with `regexp-composer` `Pattern` type (either a simple string, pattern object, or array of pattern objects).

### `cached(grammarExpression)`

Store the parsed result of this grammar expression and reuse it when it's subsequently evaluated **at the same text position**.

### `uncached(grammarExpression)`

Don't cache this grammar expression.

## License

MIT
