export const jsonSample1 = JSON.stringify([
	{
		"yo": 23,
		"man": "h\"ey"
	}
], undefined, 4)

export const jsonSample2 = JSON.stringify({
	"web-app": {
		"servlet": [
			{
				"servlet-name": "cofaxCDS",
				"servlet-class": "org.cofax.cds.CDSServlet",
				"init-param": {
					"configGlossary:installationAt": "Philadelphia, PA",
					"configGlossary:adminEmail": "ksm@pobox.com",
					"configGlossary:poweredBy": "Cofax",
					"configGlossary:poweredByIcon": "/images/cofax.gif",
					"configGlossary:staticPath": "/content/static",
					"templateProcessorClass": "org.cofax.WysiwygTemplate",
					"templateLoaderClass": "org.cofax.FilesTemplateLoader",
					"templatePath": "templates",
					"templateOverridePath": "",
					"defaultListTemplate": "listTemplate.htm",
					"defaultFileTemplate": "articleTemplate.htm",
					"useJSP": false,
					"jspListTemplate": "listTemplate.jsp",
					"jspFileTemplate": "articleTemplate.jsp",
					"cachePackageTagsTrack": 200,
					"cachePackageTagsStore": 200,
					"cachePackageTagsRefresh": 60,
					"cacheTemplatesTrack": 100,
					"cacheTemplatesStore": 50,
					"cacheTemplatesRefresh": 15,
					"cachePagesTrack": 200,
					"cachePagesStore": 100,
					"cachePagesRefresh": 10,
					"cachePagesDirtyRead": 10,
					"searchEngineListTemplate": "forSearchEnginesList.htm",
					"searchEngineFileTemplate": "forSearchEngines.htm",
					"searchEngineRobotsDb": "WEB-INF/robots.db",
					"useDataStore": true,
					"dataStoreClass": "org.cofax.SqlDataStore",
					"redirectionClass": "org.cofax.SqlRedirection",
					"dataStoreName": "cofax",
					"dataStoreDriver": "com.microsoft.jdbc.sqlserver.SQLServerDriver",
					"dataStoreUrl": "jdbc:microsoft:sqlserver://LOCALHOST:1433;DatabaseName=goon",
					"dataStoreUser": "sa",
					"dataStorePassword": "dataStoreTestQuery",
					"dataStoreTestQuery": "SET NOCOUNT ON;select test='test';",
					"dataStoreLogFile": "/usr/local/tomcat/logs/datastore.log",
					"dataStoreInitConns": 10,
					"dataStoreMaxConns": 100,
					"dataStoreConnUsageLimit": 100,
					"dataStoreLogLevel": "debug",
					"maxUrlLength": 500
				}
			},
			{
				"servlet-name": "cofaxEmail",
				"servlet-class": "org.cofax.cds.EmailServlet",
				"init-param": {
					"mailHost": "mail1",
					"mailHostOverride": "mail2"
				}
			},
			{
				"servlet-name": "cofaxAdmin",
				"servlet-class": "org.cofax.cds.AdminServlet"
			},

			{
				"servlet-name": "fileServlet",
				"servlet-class": "org.cofax.cds.FileServlet"
			},
			{
				"servlet-name": "cofaxTools",
				"servlet-class": "org.cofax.cms.CofaxToolsServlet",
				"init-param": {
					"templatePath": "toolstemplates/",
					"log": 1,
					"logLocation": "/usr/local/tomcat/logs/CofaxTools.log",
					"logMaxSize": "",
					"dataLog": 1,
					"dataLogLocation": "/usr/local/tomcat/logs/dataLog.log",
					"dataLogMaxSize": "",
					"removePageCache": "/content/admin/remove?cache=pages&id=",
					"removeTemplateCache": "/content/admin/remove?cache=templates&id=",
					"fileTransferFolder": "/usr/local/tomcat/webapps/content/fileTransferFolder",
					"lookInContext": 1,
					"adminGroupID": 4,
					"betaServer": true
				}
			}],
		"servlet-mapping": {
			"cofaxCDS": "/",
			"cofaxEmail": "/cofaxutil/aemail/*",
			"cofaxAdmin": "/admin/*",
			"fileServlet": "/static/*",
			"cofaxTools": "/tools/*"
		},

		"taglib": {
			"taglib-uri": "cofax.tld",
			"taglib-location": "/WEB-INF/tlds/cofax.tld"
		}
	}
}, undefined, 4)

export const xmlSample1 = `

<menu>
  <popup>
  	<test value='New'>
    <!--<menuitem value="New" onclick="CreateNewDoc()" />-->
    <menuitem value="Open" onclick="OpenDoc()" />
    <menuitem value="Close" onclick="CloseDoc()" />
  </popup>
</menu>`

export const xmlSample2 = `
<!DOCTYPE web-app
    PUBLIC "-//Sun Microsystems, Inc.//DTD Web Application 2.2//EN"
    "http://java.sun.com/j2ee/dtds/web-app_2.2.dtd">

<menu>
    <header>Adobe SVG Viewer</header>
    <item action="Open" id="Open">Open</item>
    <item action="OpenNew" id="OpenNew">Open New</item>
    <separator/>
    <item action="ZoomIn" id="ZoomIn">Zoom In</item>
    <item action="ZoomOut" id="ZoomOut">Zoom Out</item>
    <item action="OriginalView" id="OriginalView">Original View</item>
    <separator/>
    <item action="Quality" id="Quality">Quality</item>
    <item action="Pause" id="Pause">Pause</item>
    <item action="Mute" id="Mute">Mute</item>
    <separator/>
    <item action="Find" id="Find">Find...</item>
    <item action="FindAgain" id="FindAgain">Find Again</item>
    <item action="Copy" id="Copy">Copy</item>
    <item action="CopyAgain" id="CopyAgain">Copy Again</item>
    <item action="CopySVG" id="CopySVG">Copy SVG</item>
    <item action="ViewSVG" id="ViewSVG">View SVG</item>
    <item action="ViewSource" id="ViewSource">View Source</item>
    <item action="SaveAs" id="SaveAs">Save As</item>
    <separator/>
    <item action="Help" id="Help">Help</item>
    <item action="About" id="About">About Adobe CVG Viewer...</item>
</menu>`

export const xmlSample3 = `
<!DOCTYPE web-app
    PUBLIC "-//Sun Microsystems, Inc.//DTD Web Application 2.2//EN"
    "http://java.sun.com/j2ee/dtds/web-app_2.2.dtd">
<web-app>
	<servlet>
		<servlet-name>
            cofaxCDS
        </servlet-name>
		<servlet-class>
            org.cofax.cds.CDSServlet
        </servlet-class>
		<init-param>
			<param-name>configGlossary:installationAt</param-name>
			<param-value>Philadelphia, PA</param-value>
		</init-param>
		<init-param>
			<param-name>configGlossary:adminEmail</param-name>
			<param-value>ksm@pobox.com</param-value>
		</init-param>
		<init-param>
			<param-name>configGlossary:poweredBy</param-name>
			<param-value>Cofax</param-value>
		</init-param>
		<init-param>
			<param-name>configGlossary:poweredByIcon</param-name>
			<param-value>/images/cofax.gif</param-value>
		</init-param>
		<init-param>
			<param-name>configGlossary:staticPath</param-name>
			<param-value>/content/static</param-value>
		</init-param>
		<init-param>
			<param-name>templateProcessorClass</param-name>
			<param-value>org.cofax.WysiwygTemplate</param-value>
		</init-param>
		<init-param>
			<param-name>templateLoaderClass</param-name>
			<param-value>org.cofax.FilesTemplateLoader</param-value>
		</init-param>
		<init-param>
			<param-name>templatePath</param-name>
			<param-value>templates</param-value>
		</init-param>
		<init-param>
			<param-name>templateOverridePath</param-name>
			<param-value></param-value>
		</init-param>
		<init-param>
			<param-name>defaultListTemplate</param-name>
			<param-value>listTemplate.htm</param-value>
		</init-param>
		<init-param>
			<param-name>defaultFileTemplate</param-name>
			<param-value>articleTemplate.htm</param-value>
		</init-param>
		<init-param>
			<param-name>useJSP</param-name>
			<param-value>false</param-value>
		</init-param>
		<init-param>
			<param-name>jspListTemplate</param-name>
			<param-value>listTemplate.jsp</param-value>
		</init-param>
		<init-param>
			<param-name>jspFileTemplate</param-name>
			<param-value>articleTemplate.jsp</param-value>
		</init-param>
		<init-param>
			<param-name>cachePackageTagsTrack</param-name>
			<param-value>200</param-value>
		</init-param>
		<init-param>
			<param-name>cachePackageTagsStore</param-name>
			<param-value>200</param-value>
		</init-param>
		<init-param>
			<param-name>cachePackageTagsRefresh</param-name>
			<param-value>60</param-value>
		</init-param>
		<init-param>
			<param-name>cacheTemplatesTrack</param-name>
			<param-value>100</param-value>
		</init-param>
		<init-param>
			<param-name>cacheTemplatesStore</param-name>
			<param-value>50</param-value>
		</init-param>
		<init-param>
			<param-name>cacheTemplatesRefresh</param-name>
			<param-value>15</param-value>
		</init-param>
		<init-param>
			<param-name>cachePagesTrack</param-name>
			<param-value>200</param-value>
		</init-param>
		<init-param>
			<param-name>cachePagesStore</param-name>
			<param-value>100</param-value>
		</init-param>
		<init-param>
			<param-name>cachePagesRefresh</param-name>
			<param-value>10</param-value>
		</init-param>
		<init-param>
			<param-name>cachePagesDirtyRead</param-name>
			<param-value>10</param-value>
		</init-param>
		<init-param>
			<param-name>searchEngineListTemplate</param-name>
			<param-value>forSearchEnginesList.htm</param-value>
		</init-param>
		<init-param>
			<param-name>searchEngineFileTemplate</param-name>
			<param-value>forSearchEngines.htm</param-value>
		</init-param>
		<init-param>
			<param-name>searchEngineRobotsDb</param-name>
			<param-value>WEB-INF/robots.db</param-value>
		</init-param>
		<init-param>
			<param-name>useDataStore</param-name>
			<param-value>true</param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreClass</param-name>
			<param-value>org.cofax.SqlDataStore</param-value>
		</init-param>
		<init-param>
			<param-name>redirectionClass</param-name>
			<param-value>org.cofax.SqlRedirection</param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreName</param-name>
			<param-value>cofax</param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreDriver</param-name>
			<param-value>com.microsoft.jdbc.sqlserver.SQLServerDriver</param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreUrl</param-name>
			<param-value>jdbc:microsoft:sqlserver://LOCALHOST:1433;DatabaseName=goon</param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreUser</param-name>
			<param-value>sa</param-value>
		</init-param>
		<init-param>
			<param-name>dataStorePassword</param-name>
			<param-value></param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreTestQuery</param-name>
			<param-value>SET NOCOUNT ON;select test='test';</param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreLogFile</param-name>
			<param-value>/usr/local/tomcat/logs/datastore.log</param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreInitConns</param-name>
			<param-value>10</param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreMaxConns</param-name>
			<param-value>100</param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreConnUsageLimit</param-name>
			<param-value>100</param-value>
		</init-param>
		<init-param>
			<param-name>dataStoreLogLevel</param-name>
			<param-value>debug</param-value>
		</init-param>
		<init-param>
			<param-name>maxUrlLength</param-name>
			<param-value>500</param-value>
		</init-param>
	</servlet>
	<servlet>
		<servlet-name>
            cofaxEmail
        </servlet-name>
		<servlet-class>
            org.cofax.cds.EmailServlet
        </servlet-class>
		<init-param>
			<param-name>mailHost</param-name>
			<param-value>mail1</param-value>
		</init-param>
		<init-param>
			<param-name>mailHostOverride</param-name>
			<param-value>mail2</param-value>
		</init-param>
	</servlet>
	<servlet>
		<servlet-name>
            cofaxAdmin
        </servlet-name>
		<servlet-class>
            org.cofax.cds.AdminServlet
        </servlet-class>
	</servlet>
	<servlet>
		<servlet-name>
             fileServlet
         </servlet-name>
		<servlet-class>
             org.cofax.cds.FileServlet
         </servlet-class>
	</servlet>
	<servlet>
		<servlet-name>
            cofaxTools
        </servlet-name>
		<servlet-class>
            org.cofax.cms.CofaxToolsServlet
        </servlet-class>
		<init-param>
			<param-name>templatePath</param-name>
			<param-value>toolstemplates/</param-value>
		</init-param>
		<init-param>
			<param-name>log</param-name>
			<param-value>1</param-value>
		</init-param>
		<init-param>
			<param-name>logLocation</param-name>
			<param-value>/usr/local/tomcat/logs/CofaxTools.log</param-value>
		</init-param>
		<init-param>
			<param-name>logMaxSize</param-name>
			<param-value></param-value>
		</init-param>
		<init-param>
			<param-name>dataLog</param-name>
			<param-value>1</param-value>
		</init-param>
		<init-param>
			<param-name>dataLogLocation</param-name>
			<param-value>/usr/local/tomcat/logs/dataLog.log</param-value>
		</init-param>
		<init-param>
			<param-name>dataLogMaxSize</param-name>
			<param-value></param-value>
		</init-param>
		<init-param>
			<param-name>removePageCache</param-name>
			<param-value>/content/admin/remove?cache=pages&id=</param-value>
		</init-param>
		<init-param>
			<param-name>removeTemplateCache</param-name>
			<param-value>/content/admin/remove?cache=templates&id=</param-value>
		</init-param>
		<init-param>
			<param-name>fileTransferFolder</param-name>
			<param-value>/usr/local/tomcat/webapps/content/fileTransferFolder</param-value>
		</init-param>
		<init-param>
			<param-name>lookInContext</param-name>
			<param-value>1</param-value>
		</init-param>
		<init-param>
			<param-name>adminGroupID</param-name>
			<param-value>4</param-value>
		</init-param>
		<init-param>
			<param-name>betaServer</param-name>
			<param-value>true</param-value>
		</init-param>
	</servlet>
	<servlet-mapping>
		<servlet-name>
    cofaxCDS
    </servlet-name>
		<url-pattern>
    /
    </url-pattern>
	</servlet-mapping>
	<servlet-mapping>
		<servlet-name>
    cofaxEmail
    </servlet-name>
		<url-pattern>
    /cofaxutil/aemail/*
    </url-pattern>
	</servlet-mapping>
	<servlet-mapping>
		<servlet-name>
        cofaxAdmin
        </servlet-name>
		<url-pattern>
        /admin/*
        </url-pattern>
	</servlet-mapping>
	<servlet-mapping>
		<servlet-name>
         fileServlet
         </servlet-name>
		<url-pattern>
         /static/*
         </url-pattern>
	</servlet-mapping>
	<servlet-mapping>
		<servlet-name>
        cofaxTools
        </servlet-name>
		<url-pattern>
        /tools/*
        </url-pattern>
	</servlet-mapping>
	<taglib>
		<taglib-uri>cofax.tld</taglib-uri>
		<taglib-location>/WEB-INF/tlds/cofax.tld</taglib-location>
	</taglib>
</web-app>
`
