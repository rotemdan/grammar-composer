import { Timer } from "./utilities/Timer.js"
import { jsonSample1, jsonSample2 } from "./test-data/TestData.js"
import { anyOf, buildGrammar } from "./GrammarComposer.js"
import { JsonGrammar } from "./test-grammars/JsonGrammar.js"
import { XmlGrammar } from "./test-grammars/XmlGrammar.js"
import { RegExpGrammar } from "./test-grammars/RegExpGrammar.js"

const log = console.log

function testBasic() {
	class MyGrammar {
		p1 = () => ['a', 'b', 'c', anyOf(this.p2, this.p3)]

		p2 = () => ['x', this.p4, 'z']

		p3 = () => ['x', this.p4, 'z', 'u']

		p4 = () => ['y']
	}

	const grammar = buildGrammar(MyGrammar, 'p1')

	const result = grammar.parse('abcxyzu')

	console.log(JSON.stringify(result, undefined, 4))
}

function testJsonParser() {
	const jsonString = jsonSample1

	const grammar = buildGrammar(JsonGrammar, 'expression')

	const iterations = 1000

	let result1: any
	let result2: any

	const timer = new Timer()

	for (let i = 0; i < iterations; i++) {
		result1 = grammar.parse(jsonString)
	}
	timer.logAndRestart('grammar.Parse')

	for (let i = 0; i < iterations; i++) {
		result2 = JSON.parse(jsonString)
	}
	timer.logAndRestart('JSON.Parse')

	log(JSON.stringify(result1, undefined, 4))
}

function testXmlParser() {
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
	// Build the grammar. 'document' is the starting production
	const grammar = buildGrammar(XmlGrammar, 'document')

	// Parse the XML string
	const parseTree = grammar.parse(xmlString)

	log(JSON.stringify(parseTree, undefined, 4))
}

async function testRegExpParser() {
	const regExpString = /^([+]?[1]?(1 )?[-.+]?\(?\d{1}[- .+]*\d{1}[- .+]*\d{1}\)?[- .+]*\d{1}[- .+]*\d{1}[- .+]*\d{1}[- .+]*\d{1}[- .+]*\d{1}[- .+]*\d{1}[- .+]*\d{1})$/.source
	//const regExpString = /^asdf{$/.source

	const grammar = buildGrammar(RegExpGrammar, 'disjunction')

	const parseTree = grammar.parse(regExpString)

	const parseTreeJson = JSON.stringify(parseTree, undefined, 4)

	log(parseTreeJson)

	const { writeFile } = await import('fs/promises')

	await writeFile('out/out.json', parseTreeJson)
}


async function testParserError1() {
	const xmlData = `<hello> wo rld <!!! `

	const grammar = buildGrammar(XmlGrammar, 'document')

	const result = grammar.parse(xmlData)

	console.log(JSON.stringify(result, undefined, 4))
}

async function testParserError2() {
	const jsonData = `{ "asdf": 12.5 `

	const grammar = buildGrammar(JsonGrammar, 'expression')

	const result = grammar.parse(jsonData)

	console.log(JSON.stringify(result, undefined, 4))
}

//testJsonParser()

testRegExpParser()
