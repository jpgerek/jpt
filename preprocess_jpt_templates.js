// First you have to customize this script to make it work with your templates.
// Download the rhino JS virtual machine:
//	http://www.mozilla.org/rhino/download.html
// You can run it with:
//	java -classpath js.jar org.mozilla.javascript.tools.shell.Main process_jpt_templates.js <statics_path>

var statics_dir = arguments[0];

//Mock browser objects
var navigator = {}, window = {}, document = {};
document.createDocumentFragment = function ( ) {
	return {
		'querySelectorAll': function ( ) {}
	}
};

load( statics_dir + '/js/jpt.js' );

var templates_html = readFile( statics_dir + '/jpt/jpt.html' );

var templates_list = templates_html.match( /<xmp[^>]+>[\s\S]*?<\/xmp>/g );


var processed_templates = [];
for( var i in templates_list ) {
	try {
		var template = templates_list[i];
		var template_id = template.match('^<xmp id="([^"]+)"')[1];
		//Take the template without the xmp tag container
		template_body = template.match( /<xmp[^>]+>([\s\S]*?)<\/xmp>/ )[1];
		var function_code = JPT._generate_function( template_body ).toString().replace( /^(\nfunction anonymous)/, 'function');
		processed_templates.push( "'" + template_id + "': " + function_code );
	} catch( e ) {
		print( "Error processing template: " + template_id );
		print( e.name, e.message );
		print( "\ntemplate_body:\n" + template_body );
		quit(2);
	}
}

print( "JPT._cache = {\n" + processed_templates.join(",") + "}" );
