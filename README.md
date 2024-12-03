# Grammar composer

A library to define, build and efficiently parse context-free grammars.

* Grammars are defined using TypeScript class declarations
* No need for separate tokenization step. Tokenization is defined as part of the grammar via embedded `Pattern` objects that are internally processed through the [`regexp-composer`](https://github.com/rotemdan/regexp-composer) regular expression library
* The generated parser accepts raw characters as input, meaning it's a form of lexer-free, or hybrid parser, supporting contextual tokenization - that is, low-level character patterns can be specialized to different high-level parser contexts, and sub-patterns captured in the low-level regular expressions are directly embedded as part of the resulting parse tree
* Top-down parsing (roughly equivalent to PEG parsing), with optional "packrat" caching that can be enabled or disabled for individual productions
* Supports right-recursion, but will currently error when left-recursion is detected
* Uses sophisticated static analysis to automatically identify and annotate optional productions
* Provides useful parse-time error reporting, identifying the exact production involved and most likely alternatives at the failed position
* Fast parsing. Optimized for speed

## Example: XML grammar

The grammar is defined within a container class `XmlGrammar`. It contains a mixture of higher-level, context-free productions and lower-level, regular expression productions.

* Context-free grammar productions are defined by anonymous functions `() => ...`
* Regular expression productions are defined by `pattern(...)`

In this example, context-free operators are prefixed with `G`, and regular expression operators are prefixed with `R`, to avoid confusion between similarly named operators:
```ts
import * as G from 'grammar-composer'
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
```

Building and parsing using the XML grammar:

```ts
import { buildGrammar, parse } from 'grammar-composer'

	const xmlString = `
<!DOCTYPE web-app>

<menu>
    <header>Adobe SVG Viewer</header>
    <item action="Open" id="Open">Open</item>
    <item action="OpenNew" id="OpenNew">Open New</item>
    <separator/>
    <item action="ZoomIn" id="ZoomIn">Zoom In</item>
    <item action="ZoomOut" id="ZoomOut">Zoom Out</item>
    <separator/>
    <item action="Quality" id="Quality">Quality</item>
    <item action="Pause" id="Pause">Pause</item>
    <item action="Mute" id="Mute">Mute</item>
    <separator/>
    <item action="Find" id="Find">Find...</item>
    <item action="FindAgain" id="FindAgain">Find Again</item>
    <item action="Copy" id="Copy">Copy</item>
</menu>
`

// Build the grammar. 'document' is the starting production.
//
// Although `XmlGrammar` is a class, there's no need to instantiatte it,
// just pass it as it is.
const grammar = buildGrammar(XmlGrammar, 'document')

// Parse the XML string with the built grammar
const parseTree = parse(xmlString, grammar)
```

The resulting parse tree looks like:

```ts
[
    {
        "name": "document",
        "startOffset": 0,
        "endOffset": 644,
        "sourceText": "\n<!DOCTYPE web-app>\n\n<menu>\n    <header>Adobe SVG Viewer</header>\n    <it
em action=\"Open\" id=\"Open\">Open</item>\n    <item action=\"OpenNew\" id=\"OpenNew\">Open New</ite
m>\n    <separator/>\n    <item action=\"ZoomIn\" id=\"ZoomIn\">Zoom In</item>\n    <item action=\"Zo
omOut\" id=\"ZoomOut\">Zoom Out</item>\n    <separator/>\n    <item action=\"Quality\" id=\"Quality\"
>Quality</item>\n    <item action=\"Pause\" id=\"Pause\">Pause</item>\n    <item action=\"Mute\" id=\
"Mute\">Mute</item>\n    <separator/>\n    <item action=\"Find\" id=\"Find\">Find...</item>\n    <ite
m action=\"FindAgain\" id=\"FindAgain\">Find Again</item>\n    <item action=\"Copy\" id=\"Copy\">Copy
</item>\n</menu>\n\n",
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
                        "name": "declarationTagOpening",
                        "startOffset": 1,
                        "endOffset": 11,
                        "sourceText": "<!DOCTYPE ",
                        "children": [
                            {
                                "name": "tagName",
                                "startOffset": 3,
                                "endOffset": 10,
                                "sourceText": "DOCTYPE"
                            }
                        ]
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
                    },
                    {
                        "name": "tagEnd",
                        "startOffset": 18,
                        "endOffset": 19,
                        "sourceText": ">",
                        "children": []
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
                        "name": "openingTagStart",
                        "startOffset": 21,
                        "endOffset": 26,
                        "sourceText": "<menu",
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
                        "name": "tagEnd",
                        "startOffset": 26,
                        "endOffset": 27,
                        "sourceText": ">",
                        "children": []
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
                        "name": "openingTagStart",
                        "startOffset": 32,
                        "endOffset": 39,
                        "sourceText": "<header",
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
                        "name": "tagEnd",
                        "startOffset": 39,
                        "endOffset": 40,
                        "sourceText": ">",
                        "children": []
                    }
                ]
            },

...
```

## Operators

Context-free operators are mostly named similarly to the ones in [`regexp-composer`](https://github.com/rotemdan/regexp-composer).

### `zeroOrMore(grammarElement)`

Match the grammar element zero or more times.

### `oneOrMore(grammarElement)`

Match the grammar element one or more times.

### `anyOf(grammarElement1, grammarElement2, grammarElement3, ...)`

Match any of the grammar elements. The first successful match, in order, would be accepted without trying subsequent ones.

### `bestOf(grammarElement1, grammarElement2, grammarElement3, ...)`

Match the best grammar element. All possibilities would be tried, and the the longest match (in terms of character count) would be chosen.

### `possibly(grammarElement)`

Optionally accept the grammar element, or skip if it doesn't match.

### `pattern(regexpPattern)`

Accept a regular expression pattern compatible with `regexp-composer` `Pattern` type (either a simple string, pattern object, or array of pattern objects).

### `cached(grammarElement)`

Store the result of parsing using this grammar element and reuse when it's subsequently evaluated **at the same text position**.

### `uncached(grammarElement)`

Don't cache this grammar element.

## Future

* Provide custom parser functions

## License

MIT
