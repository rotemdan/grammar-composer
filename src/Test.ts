import { Timer } from "./utilities/Timer.js"
import { jsonSample2 } from "./test-data/TestData.js"
import { anyOf, buildGrammar, parse } from "./GrammarComposer.js"
import { JsonGrammar } from "./test-grammars/JsonGrammar.js"
import { XmlGrammar } from "./test-grammars/XmlGrammar.js"

const log = console.log

function testBasic() {
	class MyGrammar {
		p1 = () => ['a', 'b', 'c', anyOf(this.p2, this.p3)]

		p2 = () => ['x', this.p4, 'z']

		p3 = () => ['x', this.p4, 'z', 'u']

		p4 = () => ['y']
	}

	const grammar = buildGrammar(MyGrammar, 'p1')

	const result = parse('abcxyzu', grammar)

	console.log(JSON.stringify(result, undefined, 4))
}


function testJsonParser() {
	const jsonString = jsonSample2

	const grammar = buildGrammar(JsonGrammar, 'expression')

	function run() {
		const timer = new Timer()
		const result1 = parse(jsonString, grammar)
		timer.logAndRestart('Parse')

		const result2 = JSON.parse(jsonString)
		timer.logAndRestart('JSON.Parse')

		log(JSON.stringify(result2, undefined, 4))
	}

	for (let i = 0; i < 1; i++) {
		run()
	}
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
	const parseTree = parse(xmlString, grammar)

	log(JSON.stringify(parseTree, undefined, 4))
}


async function testParserError1() {
	const xmlData = `<hello> wo rld <!!! `

	const grammar = buildGrammar(XmlGrammar, 'document')

	const result = parse(xmlData, grammar)

	console.log(JSON.stringify(result, undefined, 4))
}

async function testParserError2() {
	const jsonData = `{ "asdf": 12.5 `

	const grammar = buildGrammar(JsonGrammar, 'expression')

	const result = parse(jsonData, grammar)

	console.log(JSON.stringify(result, undefined, 4))
}

testXmlParser()
