/*\
title: $:/plugins/BTC/secrets-vault/widgets/action-vault.js
type: application/javascript
module-type: widget

Action widget for vault operations

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var ActionVaultWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
ActionVaultWidget.prototype = new Widget();

/*
Render this widget into the DOM
*/
ActionVaultWidget.prototype.render = function(parent,nextSibling) {
	this.computeAttributes();
	this.execute();
};

/*
Compute the internal state of the widget
*/
ActionVaultWidget.prototype.execute = function() {
	this.actionType = this.getAttribute("type");
	this.actionParam1 = this.getAttribute("param1");
	this.actionParam2 = this.getAttribute("param2");
};

/*
Refresh the widget by ensuring our attributes are up to date
*/
ActionVaultWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.type || changedAttributes.param1 || changedAttributes.param2) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

/*
Invoke the action associated with this widget
*/
ActionVaultWidget.prototype.invokeAction = function(triggeringWidget,event) {
	var self = this;
	
	switch(this.actionType) {
		case "setup":
			// param1 should be password from a password input field
			if(this.actionParam1 && this.actionParam1.length >= 8) {
				return $tw.secretsManager.setPassword(this.actionParam1).then(function() {
					$tw.wiki.addTiddler({title: "$:/temp/vault-status", text: "Vault initialized successfully!"});
					return true;
				}).catch(function(error) {
					alert("Error setting up vault: " + error.message);
					return false;
				});
			} else {
				alert("Password must be at least 8 characters long");
				return false;
			}
			break;
			
		case "unlock":
			// param1 should be password
			if(this.actionParam1) {
				return $tw.secretsManager.unlock(this.actionParam1).then(function() {
					$tw.wiki.addTiddler({title: "$:/temp/vault-status", text: "Vault unlocked!"});
					return true;
				}).catch(function(error) {
					alert("Invalid password");
					return false;
				});
			}
			break;
			
		case "lock":
			$tw.secretsManager.lock();
			$tw.wiki.addTiddler({title: "$:/temp/vault-status", text: "Vault locked"});
			return true;
			
		case "add-secret":
			// param1 = name, param2 = value
			if(this.actionParam1 && this.actionParam2) {
				return $tw.secretsManager.addSecret(this.actionParam1, this.actionParam2).then(function() {
					$tw.wiki.addTiddler({title: "$:/temp/vault-status", text: "Secret added successfully!"});
					return true;
				}).catch(function(error) {
					alert("Error: " + error.message);
					return false;
				});
			} else {
				alert("Please provide both name and value");
				return false;
			}
			break;
			
		case "delete-secret":
			// param1 = name
			if(this.actionParam1) {
				return $tw.secretsManager.deleteSecret(this.actionParam1).then(function() {
					$tw.wiki.addTiddler({title: "$:/temp/vault-status", text: "Secret deleted!"});
					return true;
				}).catch(function(error) {
					alert("Error: " + error.message);
					return false;
				});
			}
			break;
	}
	
	return this.invokeActions(triggeringWidget,event);
};

exports["action-vault"] = ActionVaultWidget;

})();