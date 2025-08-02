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
		var buttonBackgroundColor = paletteData["button-background"] || primaryColor;
		var buttonForegroundColor = paletteData["button-foreground"] || (this.isColorDark(buttonBackgroundColor) ? "#ffffff" : "#000000");
		var codeBackgroundColor = paletteData["code-background"] || "#f0f0f0";
		var foregroundColor = paletteData.foreground || "#333333";
		var mutedForegroundColor = paletteData["muted-foreground"] || "#888888";
		var tableBorderColor = paletteData["table-border"] || "#ddd";
		
		// Create styles for shadow DOM
		var style = this.document.createElement("style");
		style.textContent = [
			":host { display: inline-block; }",
			".secret-container { display: inline-flex; align-items: center; gap: 4px; }",
			".secret-button { ",
			"  background: " + buttonBackgroundColor + ";",
			"  color: " + buttonForegroundColor + ";",
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
			".copy-button.copied { background: " + mutedForegroundColor + "; }",
			"/* Password prompt styles */",
			".password-prompt-container {",
			"  display: inline-flex;",
			"  align-items: center;",
			"  gap: 8px;",
			"}",
			".password-prompt-container input {",
			"  padding: 4px 30px 4px 8px;",
			"  border: 1px solid " + tableBorderColor + ";",
			"  border-radius: 3px;",
			"  font-size: 13px;",
			"  width: 150px;",
			"  background: " + (paletteData.background || "#ffffff") + ";",
			"  color: " + foregroundColor + ";",
			"}",
			".password-prompt-container input:focus {",
			"  outline: none;",
			"  border-color: " + primaryColor + ";",
			"}"
		].join("\n");
		shadow.appendChild(style);
		
		// Create secret container
		var secretContainer = this.document.createElement("div");
		secretContainer.className = "secret-container";
		
		// Create reveal button
		var revealButton = this.document.createElement("button");
		revealButton.className = "secret-button";
		
		// Get username if available
		var buttonText = "🔒 " + this.secretName;
		revealButton.textContent = buttonText;
		
		// Decrypt username asynchronously and append
		if($tw.secretsManager && $tw.secretsManager.isUnlocked()) {
			$tw.secretsManager.getUsername(this.secretName).then(function(username) {
				if(username) {
					revealButton.textContent = buttonText + " (" + username + ")";
				}
			}).catch(function() {
				// Ignore errors
			});
		}
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
		
		// Add copy button if vault is unlocked
		if($tw.secretsManager && $tw.secretsManager.isUnlocked()) {
			var copyButton = this.document.createElement("button");
			copyButton.className = "copy-button";
			copyButton.textContent = "Copy";
			copyButton.onclick = function() {
				self.copySecretDirectly(this);
			};
			secretContainer.appendChild(copyButton);
		}
		
		shadow.appendChild(secretContainer);
	} else {
		// Fallback for browsers without Shadow DOM
		// Get username if available
		var buttonText = "🔒 " + this.secretName;
		
		container.innerHTML = '<button class="tc-btn-invisible tc-tiddlylink">' + 
			$tw.utils.htmlEncode(buttonText) + '</button>';
		
		// Decrypt username asynchronously and update button text
		if($tw.secretsManager && $tw.secretsManager.isUnlocked() && container.firstChild) {
			var button = container.firstChild;
			$tw.secretsManager.getUsername(this.secretName).then(function(username) {
				if(username) {
					button.textContent = buttonText + " (" + username + ")";
				}
			}).catch(function() {
				// Ignore errors
			});
		}
		
		// Add copy button if vault is unlocked
		if($tw.secretsManager && $tw.secretsManager.isUnlocked()) {
			container.innerHTML += ' <button class="tc-btn-invisible" style="color:#28a745;">Copy</button>';
			if(container.lastChild) {
				container.lastChild.onclick = function() {
					self.copySecretDirectly(this);
				};
			}
		}
		
		if(container.firstChild) {
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
		// Show custom password prompt
		this.showPasswordPrompt(shadow, container, function() {
			self.revealSecret(shadow, container);
		});
		return;
	}
	
	$tw.secretsManager.getSecret(this.secretName).then(function(secret) {
		// Clear container
		container.innerHTML = "";
		
		// Create the same button as when hidden
		var hideButton = self.document.createElement("button");
		hideButton.className = "secret-button";
		
		// Get username if available
		var buttonText = "🔒 " + self.secretName;
		hideButton.textContent = buttonText;
		
		// Decrypt username asynchronously
		if($tw.secretsManager) {
			$tw.secretsManager.getUsername(self.secretName).then(function(username) {
				if(username) {
					hideButton.textContent = buttonText + " (" + username + ")";
				}
			}).catch(function() {
				// Ignore errors
			});
		}
		hideButton.title = "Click to hide, Ctrl+Click to copy";
		
		// Create revealed secret span
		var secretSpan = self.document.createElement("span");
		secretSpan.className = "secret-revealed";
		secretSpan.textContent = secret;
		
		// Create copy button
		var copyButton = self.document.createElement("button");
		copyButton.className = "copy-button";
		copyButton.textContent = "Copy";
		copyButton.onclick = function() {
			self.copyToClipboard(secret, copyButton);
		};
		
		// Now add the event listener with copyButton in scope
		hideButton.addEventListener("click", function(event) {
			// Check for Ctrl+Click (Windows/Linux) or Cmd+Click (Mac)
			if(event.ctrlKey || event.metaKey) {
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				self.copyToClipboard(secret, copyButton);
				return false;
			}
			self.hideSecret(shadow, container);
		}, false);
		
		// Append all elements
		container.appendChild(hideButton);
		container.appendChild(secretSpan);
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
		// Show custom password prompt for fallback mode
		this.showPasswordPromptFallback(container, function() {
			self.revealSecretFallback(container);
		});
		return;
	}
	
	$tw.secretsManager.getSecret(this.secretName).then(function(secret) {
		// Get palette colors for fallback
		var palette = $tw.wiki.getTiddlerText("$:/palette");
		var paletteData = palette ? $tw.wiki.getTiddlerDataCached(palette) : {};
		var codeBackgroundColor = paletteData["code-background"] || "#f0f0f0";
		
		// Get username if available
		var buttonText = "🔒 " + self.secretName;
		
		container.innerHTML = '<button class="tc-btn-invisible tc-tiddlylink" title="Click to hide, Ctrl+Click to copy">' + 
			$tw.utils.htmlEncode(buttonText) + '</button>' +
			'<span style="background:' + codeBackgroundColor + ';padding:2px 6px;border-radius:3px;font-family:monospace;margin-left:4px;">' +
			$tw.utils.htmlEncode(secret) + '</span> ' +
			'<button class="tc-btn-invisible" style="color:#28a745;">Copy</button>';
		
		// Make button clickable to hide
		if(container.firstChild) {
			container.firstChild.addEventListener("click", function(event) {
				// Check for Ctrl+Click (Windows/Linux) or Cmd+Click (Mac)
				if(event.ctrlKey || event.metaKey) {
					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation();
					self.copyToClipboard(secret, container.lastChild || null);
					return false;
				}
				self.hideSecretFallback(container);
			}, false);
		}
		
		// Copy button
		if(container.lastChild) {
			container.lastChild.onclick = function() {
				self.copyToClipboard(secret, this);
			};
		}
		
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
	
	// Get username if available
	var buttonText = "🔒 " + this.secretName;
	revealButton.textContent = buttonText;
	
	// Decrypt username asynchronously
	if($tw.secretsManager && $tw.secretsManager.isUnlocked()) {
		$tw.secretsManager.getUsername(this.secretName).then(function(username) {
			if(username) {
				revealButton.textContent = buttonText + " (" + username + ")";
			}
		}).catch(function() {
			// Ignore errors
		});
	}
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
		self.revealSecret(shadow, container);
	}, false);
	
	container.appendChild(revealButton);
	
	// Add copy button if vault is unlocked
	if($tw.secretsManager && $tw.secretsManager.isUnlocked()) {
		var copyButton = this.document.createElement("button");
		copyButton.className = "copy-button";
		copyButton.textContent = "Copy";
		copyButton.onclick = function() {
			self.copySecretDirectly(this);
		};
		container.appendChild(copyButton);
	}
};

SecretWidget.prototype.hideSecretFallback = function(container) {
	var self = this;
	
	// Clear any existing timeout
	if(this.autoHideTimeout) {
		clearTimeout(this.autoHideTimeout);
		this.autoHideTimeout = null;
	}
	
	// Get username if available
	var buttonText = "🔒 " + this.secretName;
	
	container.innerHTML = '<button class="tc-btn-invisible tc-tiddlylink" title="Click to reveal, Ctrl+Click to copy">' + 
		$tw.utils.htmlEncode(buttonText) + '</button>';
	
	// Decrypt username asynchronously and update button
	if($tw.secretsManager && $tw.secretsManager.isUnlocked() && container.firstChild) {
		var button = container.firstChild;
		$tw.secretsManager.getUsername(this.secretName).then(function(username) {
			if(username) {
				button.textContent = buttonText + " (" + username + ")";
			}
		}).catch(function() {
			// Ignore errors
		});
	}
	
	// Add copy button if vault is unlocked
	if($tw.secretsManager && $tw.secretsManager.isUnlocked()) {
		container.innerHTML += ' <button class="tc-btn-invisible" style="color:#28a745;">Copy</button>';
		if(container.lastChild) {
			container.lastChild.onclick = function() {
				self.copySecretDirectly();
			};
		}
	}
	
	if(container.firstChild) {
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

SecretWidget.prototype.copySecretDirectly = function(button) {
	var self = this;
	
	if(!$tw.secretsManager) {
		alert("Secrets vault is not initialized");
		return;
	}
	
	if(!$tw.secretsManager.isUnlocked()) {
		// Show custom password prompt
		// For direct copy, we need to determine if we're in shadow DOM or fallback
		if(this.parentDomNode && this.parentDomNode.querySelector('.tc-secret-widget')) {
			var widgetContainer = this.parentDomNode.querySelector('.tc-secret-widget');
			if(widgetContainer && widgetContainer.shadowRoot) {
				// Shadow DOM mode
				this.showPasswordPrompt(widgetContainer.shadowRoot, widgetContainer.shadowRoot.querySelector('.secret-container'), function() {
					self.copySecretDirectly(button);
				});
			} else {
				// Fallback mode
				this.showPasswordPromptFallback(widgetContainer, function() {
					self.copySecretDirectly(button);
				});
			}
		}
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
				
				// If button provided, show visual feedback
				if(button && button.textContent) {
					var originalText = button.textContent;
					button.textContent = "Copied!";
					if(button.classList) {
						button.classList.add("copied");
					}
					setTimeout(function() {
						button.textContent = originalText;
						if(button.classList) {
							button.classList.remove("copied");
						}
					}, 2000);
				}
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

SecretWidget.prototype.showPasswordPrompt = function(shadow, container, successCallback) {
	var self = this;
	
	// Clear container
	container.innerHTML = "";
	
	// Create prompt UI
	var promptContainer = this.document.createElement("div");
	promptContainer.className = "password-prompt-container";
	
	// Password input wrapper
	var passwordWrapper = this.document.createElement("div");
	passwordWrapper.style.cssText = "position: relative; display: inline-block;";
	
	var passwordInput = this.document.createElement("input");
	passwordInput.type = "password";
	passwordInput.placeholder = "Enter password";
	
	// Handle paste events
	passwordInput.addEventListener('paste', function(e) {
		e.stopPropagation();
	}, true);
	passwordInput.addEventListener('cut', function(e) {
		e.stopPropagation();
	}, true);
	passwordInput.addEventListener('copy', function(e) {
		e.stopPropagation();
	}, true);
	
	// Toggle password visibility button
	var toggleButton = this.document.createElement("button");
	toggleButton.innerHTML = "👁";
	toggleButton.style.cssText = "position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 2px; font-size: 14px; opacity: 0.6;";
	toggleButton.onclick = function(e) {
		e.preventDefault();
		e.stopPropagation();
		if(passwordInput.type === "password") {
			passwordInput.type = "text";
			toggleButton.innerHTML = "👁‍🗨";
		} else {
			passwordInput.type = "password";
			toggleButton.innerHTML = "👁";
		}
	};
	
	passwordWrapper.appendChild(passwordInput);
	passwordWrapper.appendChild(toggleButton);
	
	// Unlock button
	var unlockButton = this.document.createElement("button");
	unlockButton.className = "secret-button";
	unlockButton.textContent = "Unlock";
	
	// Cancel button
	var cancelButton = this.document.createElement("button");
	cancelButton.className = "secret-button";
	cancelButton.textContent = "Cancel";
	cancelButton.style.cssText = "background: #6c757d;";
	
	// Error message div
	var errorDiv = this.document.createElement("div");
	errorDiv.style.cssText = "color: #dc3545; font-size: 12px; margin-top: 4px; display: none;";
	
	// Handle unlock
	var attemptUnlock = function() {
		if(!passwordInput.value) {
			errorDiv.textContent = "Please enter a password";
			errorDiv.style.display = "block";
			return;
		}
		
		$tw.secretsManager.unlock(passwordInput.value).then(function() {
			// Successfully unlocked
			successCallback();
		}).catch(function(error) {
			passwordInput.value = "";
			errorDiv.style.display = "block";
			
			// Check if it's a lockout message
			if(error.message.includes("Too many attempts")) {
				errorDiv.textContent = error.message;
			} else if($tw.secretsManager.attempts) {
				var remainingAttempts = 5 - $tw.secretsManager.attempts;
				if(remainingAttempts > 0) {
					errorDiv.textContent = "Invalid password. " + remainingAttempts + " attempt" + (remainingAttempts > 1 ? "s" : "") + " remaining";
				} else {
					errorDiv.textContent = "Too many failed attempts. Please wait 5 minutes.";
				}
			} else {
				errorDiv.textContent = "Invalid password";
			}
			passwordInput.focus();
		});
	};
	
	unlockButton.onclick = attemptUnlock;
	
	cancelButton.onclick = function() {
		self.hideSecret(shadow, container);
	};
	
	// Handle Enter key
	passwordInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			attemptUnlock();
		}
	};
	
	// Assemble UI
	promptContainer.appendChild(passwordWrapper);
	promptContainer.appendChild(unlockButton);
	promptContainer.appendChild(cancelButton);
	
	container.appendChild(promptContainer);
	container.appendChild(errorDiv);
	
	// Focus password input
	passwordInput.focus();
};

SecretWidget.prototype.showPasswordPromptFallback = function(container, successCallback) {
	var self = this;
	
	// Save original content
	var originalContent = container.innerHTML;
	
	// Clear container
	container.innerHTML = "";
	
	// Create prompt UI
	var promptContainer = this.document.createElement("span");
	promptContainer.style.cssText = "display: inline-flex; align-items: center; gap: 4px;";
	
	var passwordInput = this.document.createElement("input");
	passwordInput.type = "password";
	passwordInput.placeholder = "Enter password";
	passwordInput.style.cssText = "padding: 2px 6px; border: 1px solid #ccc; border-radius: 3px; font-size: 13px; width: 120px;";
	
	var unlockButton = this.document.createElement("button");
	unlockButton.className = "tc-btn-invisible";
	unlockButton.textContent = "Unlock";
	unlockButton.style.cssText = "padding: 2px 8px; color: #0066cc;";
	
	var cancelButton = this.document.createElement("button");
	cancelButton.className = "tc-btn-invisible";
	cancelButton.textContent = "Cancel";
	cancelButton.style.cssText = "padding: 2px 8px; color: #6c757d;";
	
	// Handle unlock
	var attemptUnlock = function() {
		if(!passwordInput.value) {
			alert("Please enter a password");
			return;
		}
		
		$tw.secretsManager.unlock(passwordInput.value).then(function() {
			// Successfully unlocked
			successCallback();
		}).catch(function(error) {
			passwordInput.value = "";
			
			// Check if it's a lockout message
			if(error.message.includes("Too many attempts")) {
				alert(error.message);
			} else if($tw.secretsManager.attempts) {
				var remainingAttempts = 5 - $tw.secretsManager.attempts;
				if(remainingAttempts > 0) {
					alert("Invalid password. " + remainingAttempts + " attempt" + (remainingAttempts > 1 ? "s" : "") + " remaining");
				} else {
					alert("Too many failed attempts. Please wait 5 minutes.");
				}
			} else {
				alert("Invalid password");
			}
			passwordInput.focus();
		});
	};
	
	unlockButton.onclick = attemptUnlock;
	
	cancelButton.onclick = function() {
		container.innerHTML = originalContent;
		// Re-bind the click handler
		if(container.firstChild) {
			container.firstChild.addEventListener("click", function(event) {
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
	};
	
	// Handle Enter key
	passwordInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			attemptUnlock();
		}
	};
	
	// Assemble UI
	promptContainer.appendChild(passwordInput);
	promptContainer.appendChild(unlockButton);
	promptContainer.appendChild(cancelButton);
	
	container.appendChild(promptContainer);
	
	// Focus password input
	passwordInput.focus();
};

/*
Compute the internal state of the widget
*/
SecretWidget.prototype.execute = function() {
	var rawName = this.getAttribute("name","");
	
	// Check if this is an encoded name by trying to decode it
	// If it successfully decodes to something different, use the decoded version
	if($tw.secretsManager && $tw.secretsManager.decodeSecretName) {
		var decodedName = $tw.secretsManager.decodeSecretName(rawName);
		// If the decoded name is different from the raw name, it was encoded
		this.secretName = decodedName;
	} else {
		this.secretName = rawName;
	}
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
SecretWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.name || changedTiddlers["$:/state/vault/unlocked"] || changedTiddlers["$:/palette"] || changedTiddlers["$:/secrets/vault"]) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

exports.secret = SecretWidget;

})();