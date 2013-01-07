/**
 * @Project: JPT ( Javascript Processor of Templates ).
 * @License: The MIT License.
 * @Author: Juan Pablo Guereca.
 * @Description:
 *		- It's a standalone browserside template's engine which uses Javascript as template language.
 *		- Basically it translates a template into a Javascript function and cache it for later use
 *		  achieving great performance.
 *		- It supports html script tags inside the template and unobstrusive event hooking. The code in the script tag is run when the
 *			template is injected into the DOM ( Check the hack in the code ) and the events are hooked offline ( not inserted to the DOM )
 *			in a documentFragment.
 * @Compatibility:
 *		- IE ( 6, 7 and 8 ).
 *		- FF 3.x.
 *		- Opera 10.x.
 *		- Chrome.
 *		- PlayStation 3 browser ( Netfront ).
 *		- Please report me any other browser that is compatible with.
 * @Knownbugs:
 *		- The script tags hack with iframes makes the browser status appear as loading when it executes.
 *		- You can't use inside the templates the name 'o98' because it's used for the generated html buffer.
 *		- If you need to display the tags as a literal you have to use html entities ( &gt;!, !&lt; ).
 *		- Most of the browsers add a parent node "table" if you have template with just "tr"s nodes.
 * @Todo:
 *		-
 * @Interface:
 *		- JPT.get_doc( <template_id>, [data, [events]] )
 *				returns documentFragment;
 *		- JPT.get_node( <template_id>, [ data, [events]] )
 *				return html node ( span as container ).
 *		- JPT.insert( <template_id>, <destiny_element>, [data, [events]] ).
 * @Others:
 *		- In the template js code you can add a string to the output buffer with the 'echo' function.
 *		- You can include a template inside a template calling the 'include' functions.
 *		- You can stop the html generation with a return for conditional generation very useful some times.
 *		- You can add JPT js code inside a script tag inside a JPT template.
 */
var JPT = ( function ( ) {
	var me = {};
	// Cache of the templates processed.
	// Necessary to be public to use preprocessed templates.
	me._cache = {};

	//Used for the xmp code container of the fake script tags inside the jpt templates.
	var _script_tag_counter = 0;
	var _tags = {
		'start_of_js_code': '<!',
		'end_of_js_code': '!>',
		// There must be an expression of one line between this tags.
		'start_of_js_display': '<!=',
		'end_of_js_display': '!>'
	};
	var _ps3 = /PLAYSTATION 3/.test( navigator.userAgent );
	var _ie = ( typeof window.ActiveXObject !== 'undefined' );
	var _add_event = function ( object, event_name, callback ) {
		if ( typeof callback === 'string' ) {
			callback = new Function( 'event', callback );
		}
		object[ 'on' + event_name ] = callback;
	};
	/**
	 * DOM selectors to hook events
	 * You can select by id, tag, class or partial id
	 */
	var _selectors = {
		'id': ( function ( ) {
				if ( typeof document.createDocumentFragment().querySelectorAll === 'function' ) {
					// With querySelector support
					return function ( doc_frag, id ) {
							return doc_frag.querySelectorAll( '#'+id );
					};
				/***
				 * Despite the method exists in IE 6, 7 and 8 it doesn't get the element. Lame.
					} else if ( typeof document.createDocumentFragment().getElementById !== 'undefined' ) {
						// IE's documentFragment it's a document then it supports getElementById	
						return function ( doc_frag, id ) {
								return doc_frag.getElementById( id );
						}
				*/
				} else if ( typeof document.createDocumentFragment().getElementsByTagName !== 'undefined' ) {
					// PS3's browser ( netfront ) doesn't support querySelector but doesn't getelementsByTagName
					return function ( doc_frag, id ) {
						var all_elements = doc_frag.getElementsByTagName('*');
						var all_elements_length = all_elements.length;
						for ( var i = 0; i < all_elements_length; i++ ) {
							var elem = all_elements[i];
							if ( elem.nodeType === 1 ) {
								var elem_id = elem.getAttribute('id');
								if ( elem_id !== null && elem_id === id ) {
									// The standard is just one id per document.
									return [elem];
								}
							}
						}
						return [];
					};
				}
		} )( ),
		'tag': ( function ( ) {
			// With querySelector support
			if ( typeof document.createDocumentFragment().querySelectorAll === 'function' ) {
				return function( doc_frag, tag ) {
					return doc_frag.querySelectorAll(tag);
				};
			} else if ( typeof document.createDocumentFragment().getElementsByTagName !== 'undefined' ) {
				// IE's documentFragment it's a document then it has getElementsByTagName
				// PS3's browser ( netfront ) doesn't support querySelector but doesn't getelementsByTagName
				return function( doc_frag, tag ) {			
					return doc_frag.getElementsByTagName( tag );
				};
			}
		} )( ),
		'class': ( function ( ) {
			if ( typeof document.createDocumentFragment().querySelectorAll === 'function' ) {
				// With querySelector support
				return function ( doc_frag, class_name ) {
					if ( class_name === '' ) return [];
					return doc_frag.querySelectorAll('.'+class_name);
				};
			} else if ( typeof document.getElementsByClassName === 'function' ) {
				// With getElementsByClassName support
				return function ( doc_frag, class_name ) {
					if ( class_name === '' ) return [];
					return doc_frag.getElementsByClassName( class_name );
				};
			} else if ( typeof document.createDocumentFragment().getElementsByTagName !== 'undefined' ) {
				// PS3's browser ( netfront ) doesn't support querySelector but doesn't getelementsByTagName
				return function ( doc_frag, class_name ) {
					var all_elements = doc_frag.getElementsByTagName('*');
					var regex = new RegExp( '(?:^|[ ]+)' + class_name + '(?:[ ]+|$)' );
					var selected_elements = [];
					var all_elements_length = all_elements.length;
					for ( var i = 0; i < all_elements_length; i++ ) {
						var elem = all_elements[i];
						if ( elem.nodeType === 1 ) {
							var id = elem.getAttribute('id');
							if ( id !== null && regex.test( elem.className ) ) {
								selected_elements.push( elem );
							}
						}
					}
					return selected_elements;
				};
			}
		} )( ),
		'partial_id': ( function ( ) {
				if ( typeof document.createDocumentFragment().querySelectorAll === 'function' ) {
					// With querySelector support
					return function ( doc_frag, partial_id ) {
						if ( partial_id === '' ) return [];
						return doc_frag.querySelectorAll( "[id*='" + partial_id + "']" );
					};
				} else if ( typeof document.createDocumentFragment().getElementsByTagName !== 'undefined' ) {
					// IE's documentFragment it's a document then it has getElementsByTagName
					// PS3's browser ( netfront ) doesn't support querySelector but doesn't getelementsByTagName
					return function ( doc_frag, partial_id ) {
						if ( partial_id === '' ) return [];
						var all_elements = doc_frag.getElementsByTagName('*');
						var selected_elements = [];
						var all_elements_length = all_elements.length;
						for ( var i = 0; i < all_elements_length; i++ ) {
							var elem = all_elements[i];
							if ( elem.nodeType === 1 ) {
								var id = elem.getAttribute('id');
								if ( id !== null && id.indexOf( partial_id ) === 0 ) {
									selected_elements.push( elem );
								}
							}
						}
						return selected_elements;
					};
				}
		} )( )
	};
	var _trace = ( function ( ) {
					if ( typeof console !== 'undefined' ) {
						return function ( x ) {
							console.log( x );
						};
					} else {
						return function ( ) { };
					}
				} )( );
	
	/**
	 * Inserts callback to a document fragment at the end of it.
	 * @param documentFragemnt
	 * @param function
	 * @return undefined
	 */
	var _add_insert_event = ( function( ) {
		if ( _ie ) {
			return function ( doc_frag, event_callback ) {
				// Hack for IE.
				var s = document.createElement('script');
				//s.defer = 'true';
				s.onreadystatechange = ( function ( ) {
					var callback = event_callback;
					return function ( ) {
						if ( this.readyState === 'complete' ) {
							callback();
							setTimeout( function ( ) {
								try {
									s.parentNode.removeChild( s );
									// Erase element reference.
									delete s;
								} catch( e ) { }
							}, 250 );
						}
					};
				} )( );
				doc_frag.appendChild( s );
			};
		} else {
			return function ( doc_frag, event_callback ) {
				// Hack for every browser but IE.
				var ifr = document.createElement('iframe');
				ifr.style.height = '0px';
				ifr.style.width = '0px';
				ifr.style.borderWidth = '0px';
				ifr.style.position = 'absolute';
				ifr.onload = ( function ( ) {
					return function ( ) {
						event_callback();
						// PS3 browser calls it twice
						delete event_callback;
						setTimeout( function ( ) {
							try{
								ifr.parentNode.removeChild( ifr );
								// Erase reference to ifr.
								delete ifr;
							} catch( e ) { }
						}, 250 );
					};
				} )( );
				ifr.src = 'about:blank';
				doc_frag.appendChild( ifr );
			};
		}	
	} )( );
	
	/**
	 * Generates the JPT template function
	 * @param String raw_template. the JPT template
	 * @return Function
	 */
	function _generate_function( raw_template, config ) {
		// Function to process the html literals in the template
		function process( str ) {
		    var processed_str = str
							// Remove the '!>' at the beginning of the capture
							.replace( new RegExp( '^' + _tags.end_of_js_code + '(?:\r?\n)?' ), '' )
							// Remove the '<!' at the end of the capture
							.replace( new RegExp( _tags.start_of_js_code + '$' ), '' )
							// Add a backslash to backslashes
							.split( '\\' ).join( '\\\\' )
							// Standardize the line breaks to '\n' and add a back slash '\\n'
							.split( /\r?\n/ ).join( '\\n' )
							// Add a back slash to simple quotes
							.split( "'" ).join( "\\'" );
		    // If the processed_str is empty don't add to the display string's array.
		    if ( processed_str === '' ) return '';
		    return "\necho('" + processed_str + "');";
		}
		var template = raw_template.
        // Support for script tags inside the js templates
        // In javascripts theres no 's' flag where it makes the dot match all the '\s', a way to fake it is '[\s\S]*'
		// and you make it ungreedy with the '?'.
		// Todo: support for the script tags code with html comments '<!-- //-->'
		replace( /<script(?: [^>]*)?>[\s\S]*?<\/script>/ig, function ( str ) {				
		    // Encoding the code as uri component now I don't have put it all as a one-liner, and handle the missed semicolons, comments '//..' and others.
			var js_code = str.
			    replace(/^<script(?: [^>]*)?>(?:\s*<!--)?/i,''). // Removing the start of script tag including the possibility of having '<!--'
			    replace(/(?:(?:\/\/)?\s*-->\s*)?<\/script>$/i,''); // Removing the end of script tag including the possibility of having '// -->'
		    var script_js_code_container_id = 'jpt_script_js_code_container_' + ( ++_script_tag_counter );
		    /*-- The container is wrapped with an anonymous function to keep the global scope clean --*/
			return '<xmp id="' + script_js_code_container_id + '" style="display:none">(function(){' + js_code + '})()</xmp>' +
		    '<iframe style="width:0px;height:0px;border-width:0px;position:absolute;" src="about:blank" onload="' +
		    'var container=document.getElementById(\'' + script_js_code_container_id + '\'); ' +
		    // window.eval could be used but it seems to solve some problems in chrome using setTimeout.
		    'window.setTimeout(container.innerHTML,0);' +
		    // Removing the code container
		    'try{container.parentNode.removeChild(container);delete container;}catch(e){}' +
		    //Remove the iframe from the DOM after executing the code
		    'var self=this;setTimeout(function(){try{self.parentNode.removeChild(self);delete self;}catch(e){}},300)"></iframe>';
		} );
		
		// If there is no '<!' or '!>' everthing is an html literal		
		if ( template.indexOf('<!') === -1 && template.indexOf('!>') === -1 ) {
			template = process( template );
		} else {
			// First handling the syntax '<!= ... !>'. A one-liner is expected.
			template = template.
			replace( new RegExp( _tags.start_of_js_display + '[\\s\\S]+?' + _tags.end_of_js_display, 'g' ), function( str ) {
			    return _tags.start_of_js_code + "\necho(" +
			            str.
			            replace( new RegExp( '^' + _tags.start_of_js_display ), '' ).
			            replace( new RegExp( _tags.end_of_js_display + '$' ), '' )+
			            ");\n"+
			            _tags.end_of_js_code;
			} ).
			// Take care of the html literals
			replace( new RegExp( '^|' + _tags.end_of_js_code + '(?:\r?\n)?([\\s\\S]*?)' + _tags.start_of_js_code + '|$', 'g' ), function ( str ) { return process( str ); } ).
			// Special case for the html literals at the beginning of the template
			replace( new RegExp( '^[\\s\\S]*?(?:' + _tags.start_of_js_code + ')|$' ), function ( str ) { return process( str ); } ).
			// Special case for the html literals at the end of the template
			replace( new RegExp( _tags.end_of_js_code + '(\r?\n)?[\\s\\S]*?$' ), function ( str ) { return process( str ); } );
		}
		
		// The final code of the processed template
		// Putting the template code inside an anonymous function that is called right after
		// makes it possible to use return inside the template which is so usefull sometimes.
		// Function include: param "imp" is an optional param with the list of variables to import from the parent template.
        var str_func="var o98=[];function echo(v){o98.push(v);}function include(tmp,_dat,imp){echo(JPT._get_html(tmp,_dat,data,imp));};(function(){with(data){with(JPT.HELPERS){" + template + "}}})();return o98.join('')";

		// For debug purpose, it shows the code of the generated function
		// _trace( str_func );
		
        var generated_function;
        if ( _ps3 ) {
        	eval( 'generated_function =' + 'function ( data ) { ' + str_func + '}' );
        } else {
        	generated_function = new Function( 'data', str_func );
        }
        // Checking if the template has a config
        if ( config ) {
        	generated_function.__config = eval( '(' + config + ')' );
        }
        return generated_function;
	}
	me._generate_function = _generate_function;
	
	/**
	 * Generates a template function and caches it.
	 * @param template_id: string
	 * @return boolean
	 */
	function _generate_template_func( template_id ) {
		var node = document.getElementById(template_id);
		if ( null === node ) {
			_trace( 'JPT: template: ' + template_id + ' doesn\'t exist.' );
			return;
		}
		try {
	        var config = document.getElementById( template_id ).getAttribute( '__config' );
			me._cache[template_id] = me._generate_function( node.innerHTML, config );
		} catch( e ) {
			_trace( 'JPT: error generating function ' + template_id + ': ' + e.name + ' -> ' + ( e.description || e.message ) );
			return false;
		}
        //Erasing the template container after it is processed
        document.getElementById( template_id ).parentNode.removeChild( document.getElementById( template_id ) );
        return true;
	}
	
	/**
	 * Process the JPT template and returns the html.
	 * @param template_id: string.
	 * @param data: object with the template data.
	 * @param parent_data: object with the parent template data.
	 * @param imports_list: array with the list of properties to import from the parent template or true meaning import everything.
	 * @return string|false.
	 */
	function _get_html( template_id, data, parent_data, imports_list ) {
		data = data || {};
		if ( parent_data ) {
			/*-- Template called inside a template --*/
			if ( '[object Array]' === Object.prototype.toString.call( imports_list ) ) {
				/*-- Importing from the parent data the property names in imports_list --*/
				for ( var i in imports_list ) {
					var prop_name = imports_list[i];
					if ( ! ( prop_name in data ) ) {
						data[prop_name] = parent_data[prop_name];
					}
				}
			} else if ( true === imports_list ) {
				/*-- Merge data from the parent template with the current template data --*/
				for ( var j in parent_data ) {
					if ( ! ( j in data ) ) {
						data[j] = parent_data[j];
					}
				}
			}
		}
		if ( ! ( template_id in me._cache ) ) {
			if ( false === _generate_template_func( template_id ) ) {
				return false;
			}
		}
		try {
			return me._cache[template_id]( data );
		} catch( e ) {
			_trace( 'JPT: Error running generated function ' + template_id + ': ' + e.name + ' -> ' + ( e.description || e.message ) );
			return false;
		}
	}
	// It's necessary to support the echo function in the templates.
	// Don't use it, you have the get_doc method which returns a document fragment object.
	me._get_html = _get_html;
	
	/**
	 * Get the config of a template.
	 * @param template_id: string
	 * @return object or null
	 */
	me.get_config = function ( template_id ) {
		// Generate the template if it's not already in the cache.
		if ( ! ( template_id in me._cache ) ) {
			_generate_template_func( template_id );
		}
		// If the template isn't in the cache it means it doesn't exist.
		if ( ! ( template_id in me._cache ) ) {
			return null;
		}
		// If there's no config for this template
		if ( ! ( '__config' in me._cache[template_id]  ) ) {
			return null;
		}
		return me._cache[template_id].__config;
	};
	
	/**
	 * Process a JPT template and return a document fragment
	 * @param element: element id or dom element.
	 * @param data: object with the template data.
	 * @param events: object with the selectors and event handlers.
	 * @return document fragment object.
	 */
	me.get_doc = function ( template_id, data, events ) {
		var container = document.createElement('div');
		var html = _get_html( template_id, data );
		if ( false === html ) {
			return false;
		}
		container.innerHTML = html;
		// Checking if there are events's hooks in the template's config
		var template_func = me._cache[template_id];
		if ( '__config' in template_func && 'events' in template_func.__config ) {
			// There are event so lets add them to the events
			if ( ! events ) {
				// There aren't previous events so lets just set them.
				events = template_func.__config.events;
			} else {
				// There are other previous events so lets combine them.
				var config_events = template_func.__config.events;
				var new_events = {};
				for ( var event_id in config_events ) {
					if ( event_id in events ) {
						// If the event in the config is alredy defined in the passed events
						new_events[event_id] = ( function( ) {
							var c_event = config_events[event_id];
							var e = events[event_id];
							return function ( ) {
								c_event();
								e();
							};
						} )( );
					} else {
						// There's no event collision.
						new_events[event_id] = config_events[event_id];
					}
				}
				for ( var event_id in events ) {
					if ( ! ( event_id in new_events ) ) {
						// If the event wasn't added previously add it now
						new_events[event_id] = events[event_id];
					}
				}
				events = new_events;
			}
		}
		var doc_frag = document.createDocumentFragment();
		// Add the event that triggers right before the template is injected to the DOM.
		if ( events && 'before_dom_insert' in events ) {
			_add_insert_event( doc_frag, events.before_dom_insert );
		}
		var children = container.childNodes;
		var children_length = children.length;
		// It seems you can't iterate the childrens with for ( var i in.. )
		for ( var i = 0; i < children_length; i++ ) {
			// Events handlers are lost when using cloneNode that's why they are attached after the nodes being appended to the documentFragment
			doc_frag.appendChild( children[i].cloneNode( true ) );
		}
		// Add the event that triggers when the template is injected in the DOM.
		if ( events && 'dom_insert' in events ) {
			_add_insert_event( doc_frag, events.dom_insert );
		}
		// Add the other events
		for ( var selector_type in events ) {
			for ( var needle in events[selector_type] ) {
				/*-- dom_insert and before_dom_insert events aren't in the selectors list --*/
				if ( ! ( selector_type in _selectors ) ) {
					continue;
				}
				var selector = _selectors[selector_type];
				var elements = selector( doc_frag, needle );
				var callbacks_list = events[selector_type][needle];
				for ( var event_type in callbacks_list ) {
					var callback = callbacks_list[event_type];
					for ( var j = 0; j < elements.length; j++ ) {
						_add_event( elements[j], event_type, callback );
					}
				}
			}
		}
		return doc_frag;
	};
	
	/**
	 * Process a JPT template and return an Html Node.
	 * @param element: element id or dom element.
	 * @param data: object with the template data.
	 * @param events: object with the selectors and event handlers.
	 * @return span html node.
	 */
	me.get_node = function ( template_id, data, events ) {
		var container = document.createElement( 'span' );
		var doc_frag = me.get_doc( template_id, data, events );
		container.appendChild( doc_frag );
		return container;
	};
	
	/**
	 * Inserts processed template in a specific dom element
	 * @param template_id: string.
	 * @param element: element id or dom element.
	 * @param data: object with the template data.
	 * @param events: object with the selectors and event handlers.
	 * @return boolean
	 */
	me.insert = function ( template_id, element, data, events ) {
		if ( typeof element === 'string' ) {
			var original_element = element;
			element = document.getElementById(element);
			if ( null === element ) {
				_trace( 'JPT: element ' + original_element + ' doesn\'t exist.' );
				return false;
			}
		}
		// Todo: Add some purge process to avoid IE memory leaks.
		element.innerHTML = '';
		var doc_frag = me.get_doc( template_id, data, events );
		if ( false === doc_frag ) {
			return false;
		}
		element.appendChild( doc_frag );
		return true;
	};
	
	/**
	 * Import jpt templates in xmp tags in an iframe with a specific id to the top window.
	 * @param String ifr_id.
	 * @return undefined
	 */
	me.import_templates = function ( ifr_id ) {
		var ifr = document.getElementById(ifr_id);
		var jpt;
		if ( _ie ) {
			jpt = document.createElement('span');
			jpt.style.display = 'none';
			jpt.innerHTML = ifr.contentWindow.document.getElementById('jpt').innerHTML;
		} else {
			jpt = ifr.contentWindow.document.getElementById('jpt').cloneNode(true);
		}
		document.body.appendChild( jpt );
		document.body.removeChild( ifr );
	};
	
	// Exposing public methods.
	return me;
} )( );

JPT.HELPERS = ( function (  ) {
	var me = {};
	
	/**
	 * Escape string to be displayed in a scrip tag between simple quotes
	 * @params String text
	 * @return String
	 */
	function escape_simple( text ) {
		return text.replace( '\\', '\\\\' ) // Backslash
					.replace( '\'', '\\\'' )  // Simple quotes
					.replace( /\r|\n/g, '' ); // Removing linebreaks because javascript doesn't handle them between simple quotes
	}
	me.escape_simple = escape_simple;
	
	/**
	 * Escape string to be displayed in a scrip tag between double quotes
	 * @params String text
	 * @return String
	 */
	function escape_double( text ) {
		return text.replace( '\\', '\\\\' ) // Backslash
					.replace( '"', '\\"' ) // Double quotes
					.replace( "\n", '\\n' ) // Line breaks
					.replace( "\r", '\\r' ); // Carriage returns
	}
	me.escape_double = escape_double;
	
	return me;
} )( );