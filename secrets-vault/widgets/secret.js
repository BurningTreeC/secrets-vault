/*\
title: $:/plugins/BTC/secrets-vault/widgets/secret.js
type: application/javascript
module-type: widget

Secret widget with Shadow DOM for secure display

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var SecretWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
SecretWidget.prototype = new Widget();

/*
Helper function to determine if a color is dark
*/
SecretWidget.prototype.isColorDark = function(color) {
	// Convert hex to RGB
	var hex = color.replace("#", "");
	var r = parseInt(hex.substr(0, 2), 16);
	var g = parseInt(hex.substr(2, 2), 16);
	var b = parseInt(hex.substr(4, 2), 16);
	// Calculate luminance
	var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance < 0.5;
};

/*
Render this widget into the DOM
*/
SecretWidget.prototype.render = function(parent,nextSibling) {
	var self = this;
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	
	// Create container element
	var container = this.document.createElement("span");
	container.className = "tc-secret-widget";
	
	// Check if Shadow DOM is supported
	if(container.attachShadow) {
		// Create shadow root
		var shadow = container.attachShadow({mode: "closed"});
		
		// Get palette colors
		var palette = $tw.wiki.getTiddlerText("$:/palette");
		var paletteData = palette ? $tw.wiki.getTiddlerDataCached(palette) : {};
		
		// Extract colors with fallbacks
		var primaryColor = paletteData.primary || "#4a90e2";
		var tagBackgroundColor = paletteData["tag-background"] || primaryColor;
		var tagForegroundColor = paletteData["tag-foreground"] || (this.isColorDark(tagBackgroundColor) ? "#ffffff" : "#000000");
		var codeBackgroundColor = paletteData["code-background"] || "#f0f0f0";
		var foregroundColor = paletteData.foreground || "#333333";
		var mutedForegroundColor = paletteData["muted-foreground"] || "#888888";
		
		// Create styles for shadow DOM
		var style = this.document.createElement("style");
		style.textContent = [
			":host { display: inline-block; }",
			".secret-container { display: inline-flex; align-items: center; gap: 4px; }",
			".secret-button { ",
			"  background: " + tagBackgroundColor + ";",
			"  color: " + tagForegroundColor + ";",
			"  border: none;",
			"  padding: 2px 8px;",
			"  border-radius: 3px;",
			"  cursor: pointer;",
			"  font-size: 12px;",
			"}",
			".secret-button:hover { opacity: 0.8; }",
			".secret-button:active { opacity: 0.6; }",
			".secret-revealed {",
			"  background: " + codeBackgroundColor + ";",
			"  color: " + foregroundColor + ";",
			"  padding: 2px 6px;",
			"  border-radius: 3px;",
			"  font-family: monospace;",
			"  user-select: text;",
			"}",
			".copy-button {",
			"  background: #28a745;",
			"  color: white;",
			"  border: none;",
			"  padding: 2px 6px;",
			"  border-radius: 3px;",
			"  cursor: pointer;",
			"  font-size: 11px;",
			"}",
			".copy-button:hover { opacity: 0.8; }",
			".copy-button.copied { background: " + mutedForegroundColor + "; }"
		].join("\n");
		shadow.appendChild(style);
		
		// Create secret container
		var secretContainer = this.document.createElement("div");
		secretContainer.className = "secret-container";
		
		// Create reveal button
		var revealButton = this.document.createElement("button");
		revealButton.className = "secret-button";
		revealButton.textContent = "🔒 " + this.secretName;
		revealButton.title = "Click to reveal, Ctrl+Click to copy";
		revealButton.addEventListener("click", function(event) {
			// Check for Ctrl+Click (Windows/Linux) or Cmd+Click (Mac)
			if(event.ctrlKey || event.metaKey) {
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				self.copySecretDirectly();
				return false;
			}
			self.revealSecret(shadow, secretContainer);
		}, false);
		
		secretContainer.appendChild(revealButton);
		shadow.appendChild(secretContainer);
	} else {
		// Fallback for browsers without Shadow DOM
		container.innerHTML = '<button class="tc-btn-invisible tc-tiddlylink">🔒 ' + 
			$tw.utils.htmlEncode(this.secretName) + '</button>';
		container.firstChild.addEventListener("click", function(event) {
			// Check for Ctrl+Click (Windows/Linux) or Cmd+Click (Mac)
			if(event.ctrlKey || event.metaKey) {
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				self.copySecretDirectly();
				return false;
			}
			self.revealSecretFallback(container);
		}, false);
	}
	
	parent.insertBefore(container,nextSibling);
	this.renderChildren(container,null);
	this.domNodes.push(container);
};

SecretWidget.prototype.revealSecret = function(shadow, container) {
	var self = this;
	
	if(!$tw.secretsManager) {
		alert("Secrets vault is not initialized");
		return;
	}
	
	if(!$tw.secretsManager.isUnlocked()) {
		// Show password prompt
		$tw.passwordPrompt.createPrompt({
			serviceName: "Secrets Vault",
			noUserName: true,
			submitText: "Unlock",
			cancelText: "Cancel",
			repeatPassword: false,
			canCancel: true,
			callback: function(data) {
				if(data && data.password) {
					$tw.secretsManager.unlock(data.password).then(function() {
						// Successfully unlocked, now reveal the secret
						self.revealSecret(shadow, container);
					}).catch(function(error) {
						alert("Invalid password");
					});
				}
				return true; // Prevent the dialog from reappearing
			}
		});
		return;
	}
	
	$tw.secretsManager.getSecret(this.secretName).then(function(secret) {
		// Clear container
		container.innerHTML = "";
		
		// Create the same button as when hidden
		var hideButton = self.document.createElement("button");
		hideButton.className = "secret-button";
		hideButton.textContent = "🔒 " + self.secretName;
		hideButton.title = "Click to hide";
		hideButton.onclick = function() {
			self.hideSecret(shadow, container);
		};
		container.appendChild(hideButton);
		
		// Create revealed secret span
		var secretSpan = self.document.createElement("span");
		secretSpan.className = "secret-revealed";
		secretSpan.textContent = secret;
		container.appendChild(secretSpan);
		
		// Create copy button
		var copyButton = self.document.createElement("button");
		copyButton.className = "copy-button";
		copyButton.textContent = "Copy";
		copyButton.onclick = function() {
			self.copyToClipboard(secret, copyButton);
		};
		container.appendChild(copyButton);
		
		// Auto-hide after configured timeout (default 8 seconds)
		var timeout = parseInt($tw.wiki.getTiddlerText("$:/config/SecretsVault/AutoHideTimeout", "8000"), 10);
		self.autoHideTimeout = setTimeout(function() {
			self.hideSecret(shadow, container);
		}, timeout);
	}).catch(function(error) {
		alert("Error: " + error.message);
	});
};

SecretWidget.prototype.revealSecretFallback = function(container) {
	var self = this;
	
	if(!$tw.secretsManager) {
		alert("Secrets vault is not initialized");
		return;
	}
	
	if(!$tw.secretsManager.isUnlocked()) {
		// Show password prompt
		$tw.passwordPrompt.createPrompt({
			serviceName: "Secrets Vault",
			noUserName: true,
			submitText: "Unlock",
			cancelText: "Cancel",
			repeatPassword: false,
			canCancel: true,
			callback: function(data) {
				if(data && data.password) {
					$tw.secretsManager.unlock(data.password).then(function() {
						// Successfully unlocked, now reveal the secret
						self.revealSecretFallback(container);
					}).catch(function(error) {
						alert("Invalid password");
					});
				}
				return true; // Prevent the dialog from reappearing
			}
		});
		return;
	}
	
	$tw.secretsManager.getSecret(this.secretName).then(function(secret) {
		// Get palette colors for fallback
		var palette = $tw.wiki.getTiddlerText("$:/palette");
		var paletteData = palette ? $tw.wiki.getTiddlerDataCached(palette) : {};
		var codeBackgroundColor = paletteData["code-background"] || "#f0f0f0";
		
		container.innerHTML = '<button class="tc-btn-invisible tc-tiddlylink">🔒 ' + 
			$tw.utils.htmlEncode(self.secretName) + '</button>' +
			'<span style="background:' + codeBackgroundColor + ';padding:2px 6px;border-radius:3px;font-family:monospace;margin-left:4px;">' +
			$tw.utils.htmlEncode(secret) + '</span> ' +
			'<button class="tc-btn-invisible" style="color:#28a745;">Copy</button>';
		
		// Make button clickable to hide
		container.firstChild.onclick = function() {
			self.hideSecretFallback(container);
		};
		
		// Copy button
		container.lastChild.onclick = function() {
			self.copyToClipboard(secret, this);
		};
		
		// Auto-hide after configured timeout (default 8 seconds)
		var timeout = parseInt($tw.wiki.getTiddlerText("$:/config/SecretsVault/AutoHideTimeout", "8000"), 10);
		self.autoHideTimeout = setTimeout(function() {
			self.hideSecretFallback(container);
		}, timeout);
	}).catch(function(error) {
		alert("Error: " + error.message);
	});
};

SecretWidget.prototype.hideSecret = function(shadow, container) {
	var self = this;
	
	// Clear any existing timeout
	if(this.autoHideTimeout) {
		clearTimeout(this.autoHideTimeout);
		this.autoHideTimeout = null;
	}
	
	container.innerHTML = "";
	
	var revealButton = this.document.createElement("button");
	revealButton.className = "secret-button";
	revealButton.textContent = "🔒 " + this.secretName;
	revealButton.onclick = function() {
		self.revealSecret(shadow, container);
	};
	
	container.appendChild(revealButton);
};

SecretWidget.prototype.hideSecretFallback = function(container) {
	var self = this;
	
	// Clear any existing timeout
	if(this.autoHideTimeout) {
		clearTimeout(this.autoHideTimeout);
		this.autoHideTimeout = null;
	}
	
	container.innerHTML = '<button class="tc-btn-invisible tc-tiddlylink">🔒 ' + 
		$tw.utils.htmlEncode(this.secretName) + '</button>';
	container.firstChild.onclick = function() {
		self.revealSecretFallback(container);
	};
};

SecretWidget.prototype.copyToClipboard = function(text, button) {
	var self = this;
	
	if(navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(text).then(function() {
			var originalText = button.textContent;
			button.textContent = "Copied!";
			button.classList.add("copied");
			setTimeout(function() {
				button.textContent = originalText;
				button.classList.remove("copied");
			}, 2000);
		}).catch(function(err) {
			self.fallbackCopy(text);
		});
	} else {
		this.fallbackCopy(text);
	}
};

SecretWidget.prototype.copySecretDirectly = function() {
	var self = this;
	
	if(!$tw.secretsManager) {
		alert("Secrets vault is not initialized");
		return;
	}
	
	if(!$tw.secretsManager.isUnlocked()) {
		// Show password prompt
		$tw.passwordPrompt.createPrompt({
			serviceName: "Secrets Vault",
			noUserName: true,
			submitText: "Unlock",
			cancelText: "Cancel",
			repeatPassword: false,
			canCancel: true,
			callback: function(data) {
				if(data && data.password) {
					$tw.secretsManager.unlock(data.password).then(function() {
						// Successfully unlocked, now copy the secret
						self.copySecretDirectly();
					}).catch(function(error) {
						alert("Invalid password");
					});
				}
				return true; // Prevent the dialog from reappearing
			}
		});
		return;
	}
	
	// Get and copy the secret
	$tw.secretsManager.getSecret(this.secretName).then(function(secret) {
		if(navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(secret).then(function() {
				// Show a temporary notification
				$tw.notifier.display("$:/temp/secret-copied", {
					title: "Secret Copied",
					text: "Secret \"" + self.secretName + "\" copied to clipboard"
				});
			}).catch(function(err) {
				self.fallbackCopy(secret);
			});
		} else {
			self.fallbackCopy(secret);
		}
	}).catch(function(error) {
		alert("Error: " + error.message);
	});
};

SecretWidget.prototype.fallbackCopy = function(text) {
	var textArea = this.document.createElement("textarea");
	textArea.value = text;
	textArea.style.position = "fixed";
	textArea.style.top = "-9999px";
	this.document.body.appendChild(textArea);
	textArea.select();
	try {
		this.document.execCommand("copy");
		alert("Copied to clipboard!");
	} catch(err) {
		alert("Failed to copy");
	}
	this.document.body.removeChild(textArea);
};

/*
Compute the internal state of the widget
*/
SecretWidget.prototype.execute = function() {
	this.secretName = this.getAttribute("name","");
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
SecretWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.name || changedTiddlers["$:/state/vault/unlocked"] || changedTiddlers["$:/palette"]) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

exports.secret = SecretWidget;

})();