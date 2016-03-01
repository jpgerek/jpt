# jpt
Javascript Processor of Templates

* It's a standalone browserside template's engine which uses Javascript as template language.
* Basically it translates a template into a Javascript function and cache it for later use achieving great performance.
* It supports html script tags inside the template and unobstrusive event hooking. The code in the script tag is run when the template is injected into the DOM ( Check the hack in the code ) and the events are hooked offline ( not inserted to the DOM ) in a documentFragment.
