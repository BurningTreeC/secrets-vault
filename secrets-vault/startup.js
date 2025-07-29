/*\
title: $:/plugins/BTC/secrets-vault/startup.js
type: application/javascript
module-type: startup

Startup module for secrets vault

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

// Export name and synchronous status
exports.name = "secrets-vault";
exports.platforms = ["browser"];
exports.before = ["story"];
exports.synchronous = true;

exports.startup = function() {
	// Only run in the browser
	if($tw.browser) {
		var SecretsManager = require("$:/plugins/BTC/secrets-vault/secrets-manager.js").SecretsManager;
		$tw.secretsManager = new SecretsManager();
		
		// Check if Web Crypto API is available
		if(!$tw.secretsManager.isAvailable()) {
			$tw.utils.alert("Secrets Vault: Web Crypto API is not available in this browser");
		}
		
		// Initialize vault state
		$tw.wiki.addTiddler({title: "$:/state/vault/unlocked", text: "no"});
	}
};

})();