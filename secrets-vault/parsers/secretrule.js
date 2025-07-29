/*\
title: $:/plugins/BTC/secrets-vault/parsers/secretrule.js
type: application/javascript
module-type: wikirule

Wiki text rule for secret references

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = "secret";
exports.types = {inline: true};

exports.init = function(parser) {
	this.parser = parser;
	// Match §[secret:name]
	this.matchRegExp = /§\[secret:([^\]]+)\]/mg;
};

exports.parse = function() {
	// Extract the secret name
	var secretName = this.match[1];
	
	// Move past the match
	this.parser.pos = this.matchRegExp.lastIndex;
	
	// Return a secret widget
	return [{
		type: "secret",
		attributes: {
			name: {type: "string", value: secretName}
		},
		children: []
	}];
};

})();