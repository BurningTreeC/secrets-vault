/*\
title: $:/plugins/BTC/secrets-vault/widgets/vault-manager.js
type: application/javascript
module-type: widget

Vault manager widget with Shadow DOM

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var VaultManagerWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
VaultManagerWidget.prototype = new Widget();

/*
Helper function to determine if a color is dark
*/
VaultManagerWidget.prototype.isColorDark = function(color) {
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
VaultManagerWidget.prototype.render = function(parent,nextSibling) {
	var self = this;
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	
	// Create container
	var container = this.document.createElement("div");
	container.className = "tc-vault-manager-widget";
	
	if(container.attachShadow) {
		// Create shadow root
		this.shadow = container.attachShadow({mode: "closed"});
		
		// Add styles
		var style = this.document.createElement("style");
		style.textContent = this.getStyles();
		this.shadow.appendChild(style);
		
		// Create content
		this.renderContent();
	} else {
		// Fallback without shadow DOM
		container.innerHTML = "<p>Shadow DOM not supported. Please use the regular vault manager.</p>";
	}
	
	parent.insertBefore(container,nextSibling);
	this.domNodes.push(container);
};

VaultManagerWidget.prototype.getStyles = function() {
	// Get palette colors
	var palette = $tw.wiki.getTiddlerText("$:/palette");
	var paletteData = palette ? $tw.wiki.getTiddlerDataCached(palette) : {};
	
	// Extract colors with fallbacks
	var primaryColor = paletteData.primary || "#4a90e2";
	var backgroundColor = paletteData.background || "#ffffff";
	var foregroundColor = paletteData.foreground || "#333333";
	var mutedForegroundColor = paletteData["muted-foreground"] || "#888888";
	var tableBorderColor = paletteData["table-border"] || "#ddd";
	var tableHeaderBackgroundColor = paletteData["table-header-background"] || "#f5f5f5";
	var notificationBackgroundColor = paletteData["notification-background"] || "#fff3cd";
	var tagBackgroundColor = paletteData["tag-background"] || primaryColor;
	var tagForegroundColor = paletteData["tag-foreground"] || (this.isColorDark(tagBackgroundColor) ? "#ffffff" : "#000000");
	
	return [
		":host { display: block; padding: 1em; background: " + backgroundColor + "; color: " + foregroundColor + "; }",
		".vault-section { margin-bottom: 2em; }",
		".vault-title { font-size: 1.2em; font-weight: bold; margin-bottom: 0.5em; }",
		".vault-status { padding: 0.5em; background: " + notificationBackgroundColor + "; border-radius: 4px; margin-bottom: 1em; }",
		".vault-status.error { background: #ffebee; }",
		".vault-form { display: flex; flex-direction: column; gap: 0.5em; max-width: 300px; }",
		".password-wrapper { position: relative; display: flex; align-items: center; }",
		".password-wrapper input { padding-right: 2.5em; }",
		"input { padding: 0.5em; border: 1px solid " + tableBorderColor + "; border-radius: 3px; background: " + backgroundColor + "; color: " + foregroundColor + "; width: 100%; box-sizing: border-box; }",
		".toggle-password { position: absolute; right: 0.5em; background: none; border: none; cursor: pointer; padding: 0.25em; color: " + mutedForegroundColor + "; }",
		".toggle-password:hover { color: " + foregroundColor + "; }",
		"button { ",
		"  padding: 0.5em 1em;",
		"  background: " + tagBackgroundColor + ";",
		"  color: " + tagForegroundColor + ";",
		"  border: none;",
		"  border-radius: 3px;",
		"  cursor: pointer;",
		"}",
		"button:hover { opacity: 0.8; }",
		"button:active { opacity: 0.6; }",
		"button.danger { background: #dc3545; }",
		"button.danger:hover { opacity: 0.8; }",
		".secrets-table { width: 100%; border-collapse: collapse; margin-top: 1em; }",
		".secrets-table th { text-align: left; padding: 0.5em; background: " + tableHeaderBackgroundColor + "; }",
		".secrets-table td { padding: 0.5em; border-bottom: 1px solid " + tableBorderColor + "; }",
		".table-buttons { display: flex; gap: 0.25em; }",
		".view-btn { background: #17a2b8; padding: 0.25em 0.5em; font-size: 0.9em; color: white; }",
		".copy-btn { background: #28a745; padding: 0.25em 0.5em; font-size: 0.9em; color: white; }",
		".delete-btn { background: #dc3545; padding: 0.25em 0.5em; font-size: 0.9em; color: white; }"
	].join("\n");
};

VaultManagerWidget.prototype.createPasswordInput = function(placeholder) {
	var self = this;
	
	var wrapper = this.document.createElement("div");
	wrapper.className = "password-wrapper";
	
	var input = this.document.createElement("input");
	input.type = "password";
	input.placeholder = placeholder;
	
	var toggleButton = this.document.createElement("button");
	toggleButton.className = "toggle-password";
	toggleButton.type = "button";
	toggleButton.tabIndex = -1;
	toggleButton.innerHTML = "👁";
	toggleButton.onclick = function() {
		if(input.type === "password") {
			input.type = "text";
			toggleButton.innerHTML = "👁‍🗨";
		} else {
			input.type = "password";
			toggleButton.innerHTML = "👁";
		}
	};
	
	wrapper.appendChild(input);
	wrapper.appendChild(toggleButton);
	
	return {wrapper: wrapper, input: input};
};

VaultManagerWidget.prototype.renderContent = function() {
	var self = this;
	
	// Check if secretsManager is available
	if(!$tw.secretsManager) {
		var error = this.document.createElement("div");
		error.className = "vault-status error";
		error.textContent = "Secrets Manager not initialized. Please refresh the page.";
		this.shadow.appendChild(error);
		return;
	}
	
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	
	// Clear shadow content
	while(this.shadow.lastChild && this.shadow.lastChild.tagName !== "STYLE") {
		this.shadow.removeChild(this.shadow.lastChild);
	}
	
	// Check if vault is initialized
	if(!vault || !vault.fields["secrets-verification"]) {
		this.renderInitialize();
	} else if(!$tw.secretsManager.isUnlocked()) {
		this.renderUnlock();
	} else {
		this.renderManage();
	}
};

VaultManagerWidget.prototype.renderInitialize = function() {
	var self = this;
	var section = this.document.createElement("div");
	section.className = "vault-section";
	
	var title = this.document.createElement("div");
	title.className = "vault-title";
	title.textContent = "Initialize Vault";
	section.appendChild(title);
	
	var form = this.document.createElement("div");
	form.className = "vault-form";
	
	var passwordField = this.createPasswordInput("Enter master password (min 8 chars)");
	var passwordInput = passwordField.input;
	form.appendChild(passwordField.wrapper);
	
	var confirmField = this.createPasswordInput("Confirm password");
	var confirmInput = confirmField.input;
	form.appendChild(confirmField.wrapper);
	
	var button = this.document.createElement("button");
	button.textContent = "Initialize Vault";
	
	var initializeSubmit = function() {
		if(passwordInput.value.length < 8) {
			self.showStatus("Password must be at least 8 characters long", true);
			return;
		}
		if(passwordInput.value !== confirmInput.value) {
			self.showStatus("Passwords do not match", true);
			return;
		}
		if($tw.secretsManager) {
			$tw.secretsManager.setPassword(passwordInput.value).then(function() {
				self.showStatus("Vault initialized successfully!");
				passwordInput.value = "";
				confirmInput.value = "";
				self.renderContent();
			}).catch(function(error) {
				self.showStatus("Error: " + error.message, true);
			});
		} else {
			self.showStatus("Secrets Manager not available", true);
		}
	};
	
	button.onclick = initializeSubmit;
	
	// Handle Enter key
	passwordInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			initializeSubmit();
		}
	};
	confirmInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			initializeSubmit();
		}
	};
	
	form.appendChild(button);
	
	section.appendChild(form);
	this.shadow.appendChild(section);
};

VaultManagerWidget.prototype.renderUnlock = function() {
	var self = this;
	var section = this.document.createElement("div");
	section.className = "vault-section";
	
	var title = this.document.createElement("div");
	title.className = "vault-title";
	title.textContent = "Unlock Vault";
	section.appendChild(title);
	
	var form = this.document.createElement("div");
	form.className = "vault-form";
	
	var passwordField = this.createPasswordInput("Enter master password");
	var passwordInput = passwordField.input;
	form.appendChild(passwordField.wrapper);
	
	var button = this.document.createElement("button");
	button.textContent = "Unlock";
	
	var unlockSubmit = function() {
		if($tw.secretsManager) {
			$tw.secretsManager.unlock(passwordInput.value).then(function() {
				self.showStatus("Vault unlocked!");
				passwordInput.value = "";
				self.renderContent();
			}).catch(function(error) {
				self.showStatus("Invalid password", true);
				passwordInput.value = "";
			});
		} else {
			self.showStatus("Secrets Manager not available", true);
		}
	};
	
	button.onclick = unlockSubmit;
	
	// Handle Enter key
	passwordInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			unlockSubmit();
		}
	};
	
	form.appendChild(button);
	
	section.appendChild(form);
	this.shadow.appendChild(section);
};

VaultManagerWidget.prototype.renderManage = function() {
	var self = this;
	
	// Status section
	var statusSection = this.document.createElement("div");
	statusSection.className = "vault-section";
	
	var statusTitle = this.document.createElement("div");
	statusTitle.className = "vault-title";
	statusTitle.textContent = "Vault Status";
	statusSection.appendChild(statusTitle);
	
	var status = this.document.createElement("div");
	status.className = "vault-status";
	status.textContent = "✅ Vault is unlocked";
	statusSection.appendChild(status);
	
	var lockButton = this.document.createElement("button");
	lockButton.className = "danger";
	lockButton.textContent = "🔒 Lock Vault";
	lockButton.onclick = function() {
		if($tw.secretsManager) {
			$tw.secretsManager.lock();
			self.showStatus("Vault locked");
			self.renderContent();
		}
	};
	statusSection.appendChild(lockButton);
	
	this.shadow.appendChild(statusSection);
	
	// Add secret section
	var addSection = this.document.createElement("div");
	addSection.className = "vault-section";
	
	var addTitle = this.document.createElement("div");
	addTitle.className = "vault-title";
	addTitle.textContent = "Add New Secret";
	addSection.appendChild(addTitle);
	
	var addForm = this.document.createElement("div");
	addForm.className = "vault-form";
	
	var nameInput = this.document.createElement("input");
	nameInput.type = "text";
	nameInput.placeholder = "Secret name";
	addForm.appendChild(nameInput);
	
	var valueField = this.createPasswordInput("Secret value");
	var valueInput = valueField.input;
	addForm.appendChild(valueField.wrapper);
	
	var addButton = this.document.createElement("button");
	addButton.textContent = "Add Secret";
	
	var addSecretSubmit = function() {
		if(!nameInput.value || !valueInput.value) {
			self.showStatus("Please provide both name and value", true);
			return;
		}
		if($tw.secretsManager) {
			$tw.secretsManager.addSecret(nameInput.value, valueInput.value).then(function() {
				self.showStatus("Secret added successfully!");
				nameInput.value = "";
				valueInput.value = "";
				self.renderContent();
			}).catch(function(error) {
				self.showStatus("Error: " + error.message, true);
			});
		} else {
			self.showStatus("Secrets Manager not available", true);
		}
	};
	
	addButton.onclick = addSecretSubmit;
	
	// Handle Enter key
	nameInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			addSecretSubmit();
		}
	};
	valueInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			addSecretSubmit();
		}
	};
	
	addForm.appendChild(addButton);
	
	addSection.appendChild(addForm);
	this.shadow.appendChild(addSection);
	
	// List secrets section
	var listSection = this.document.createElement("div");
	listSection.className = "vault-section";
	
	var listTitle = this.document.createElement("div");
	listTitle.className = "vault-title";
	listTitle.textContent = "Existing Secrets";
	listSection.appendChild(listTitle);
	
	var secrets = $tw.secretsManager ? $tw.secretsManager.listSecrets() : [];
	// Sort secrets alphabetically by name
	secrets.sort(function(a, b) {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});
	if(secrets.length > 0) {
		var table = this.document.createElement("table");
		table.className = "secrets-table";
		
		var thead = this.document.createElement("thead");
		var headerRow = this.document.createElement("tr");
		var nameHeader = this.document.createElement("th");
		nameHeader.textContent = "Name";
		var actionsHeader = this.document.createElement("th");
		actionsHeader.textContent = "Actions";
		headerRow.appendChild(nameHeader);
		headerRow.appendChild(actionsHeader);
		thead.appendChild(headerRow);
		table.appendChild(thead);
		
		var tbody = this.document.createElement("tbody");
		secrets.forEach(function(secret) {
			var row = self.document.createElement("tr");
			var nameCell = self.document.createElement("td");
			nameCell.textContent = "🔐 " + secret;
			nameCell.id = "secret-name-" + secret;
			var actionsCell = self.document.createElement("td");
			
			// Create button container
			var buttonContainer = self.document.createElement("div");
			buttonContainer.className = "table-buttons";
			
			// Create a closure to capture the secret value
			(function(secretName) {
				// View button
				var viewBtn = self.document.createElement("button");
				viewBtn.className = "view-btn";
				viewBtn.textContent = "View";
				viewBtn.onclick = function() {
					$tw.secretsManager.getSecret(secretName).then(function(secretValue) {
						var nameElement = self.shadow.getElementById("secret-name-" + secretName);
						if(nameElement) {
							// Toggle between showing name and value
							if(nameElement.dataset.showing === "value") {
								nameElement.textContent = "🔐 " + secretName;
								nameElement.dataset.showing = "name";
								viewBtn.textContent = "View";
							} else {
								nameElement.textContent = secretValue;
								nameElement.dataset.showing = "value";
								viewBtn.textContent = "Hide";
								// Auto-hide after 8 seconds
								setTimeout(function() {
									if(nameElement.dataset.showing === "value") {
										nameElement.textContent = "🔐 " + secretName;
										nameElement.dataset.showing = "name";
										viewBtn.textContent = "View";
									}
								}, 8000);
							}
						}
					}).catch(function(error) {
						self.showStatus("Error: " + error.message, true);
					});
				};
				
				// Copy button
				var copyBtn = self.document.createElement("button");
				copyBtn.className = "copy-btn";
				copyBtn.textContent = "Copy";
				copyBtn.onclick = function() {
					$tw.secretsManager.getSecret(secretName).then(function(secretValue) {
						if(navigator.clipboard && navigator.clipboard.writeText) {
							navigator.clipboard.writeText(secretValue).then(function() {
								self.showStatus("Secret copied to clipboard!");
								// Visual feedback
								var originalText = copyBtn.textContent;
								copyBtn.textContent = "Copied!";
								setTimeout(function() {
									copyBtn.textContent = originalText;
								}, 2000);
							}).catch(function() {
								self.fallbackCopy(secretValue);
							});
						} else {
							self.fallbackCopy(secretValue);
						}
					}).catch(function(error) {
						self.showStatus("Error: " + error.message, true);
					});
				};
				
				// Delete button
				var deleteBtn = self.document.createElement("button");
				deleteBtn.className = "delete-btn";
				deleteBtn.textContent = "Delete";
				deleteBtn.onclick = function() {
					if(confirm("Are you sure you want to delete this secret?")) {
						if($tw.secretsManager) {
							$tw.secretsManager.deleteSecret(secretName).then(function() {
								self.showStatus("Secret deleted!");
								self.renderContent();
							}).catch(function(error) {
								self.showStatus("Error: " + error.message, true);
							});
						}
					}
				};
				
				buttonContainer.appendChild(viewBtn);
				buttonContainer.appendChild(copyBtn);
				buttonContainer.appendChild(deleteBtn);
			})(secret);
			
			actionsCell.appendChild(buttonContainer);
			row.appendChild(nameCell);
			row.appendChild(actionsCell);
			tbody.appendChild(row);
		});
		table.appendChild(tbody);
		listSection.appendChild(table);
	} else {
		var emptyMsg = this.document.createElement("p");
		emptyMsg.textContent = "No secrets stored yet.";
		listSection.appendChild(emptyMsg);
	}
	
	this.shadow.appendChild(listSection);
	
	// Change password section
	var changePasswordSection = this.document.createElement("div");
	changePasswordSection.className = "vault-section";
	
	var changePasswordTitle = this.document.createElement("div");
	changePasswordTitle.className = "vault-title";
	changePasswordTitle.textContent = "Change Password";
	changePasswordSection.appendChild(changePasswordTitle);
	
	var changePasswordForm = this.document.createElement("div");
	changePasswordForm.className = "vault-form";
	
	var oldPasswordField = this.createPasswordInput("Current password");
	var oldPasswordInput = oldPasswordField.input;
	changePasswordForm.appendChild(oldPasswordField.wrapper);
	
	var newPasswordField = this.createPasswordInput("New password (min 8 chars)");
	var newPasswordInput = newPasswordField.input;
	changePasswordForm.appendChild(newPasswordField.wrapper);
	
	var confirmPasswordField = this.createPasswordInput("Confirm new password");
	var confirmPasswordInput = confirmPasswordField.input;
	changePasswordForm.appendChild(confirmPasswordField.wrapper);
	
	var changePasswordButton = this.document.createElement("button");
	changePasswordButton.textContent = "Change Password";
	
	var changePasswordSubmit = function() {
		if(newPasswordInput.value.length < 8) {
			self.showStatus("New password must be at least 8 characters long", true);
			return;
		}
		if(newPasswordInput.value !== confirmPasswordInput.value) {
			self.showStatus("New passwords do not match", true);
			return;
		}
		if($tw.secretsManager) {
			$tw.secretsManager.changePassword(oldPasswordInput.value, newPasswordInput.value).then(function() {
				self.showStatus("Password changed successfully!");
				oldPasswordInput.value = "";
				newPasswordInput.value = "";
				confirmPasswordInput.value = "";
			}).catch(function(error) {
				self.showStatus("Error: " + error.message, true);
				oldPasswordInput.value = "";
				newPasswordInput.value = "";
				confirmPasswordInput.value = "";
			});
		}
	};
	
	changePasswordButton.onclick = changePasswordSubmit;
	
	// Handle Enter key
	oldPasswordInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			changePasswordSubmit();
		}
	};
	newPasswordInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			changePasswordSubmit();
		}
	};
	confirmPasswordInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			changePasswordSubmit();
		}
	};
	
	changePasswordForm.appendChild(changePasswordButton);
	changePasswordSection.appendChild(changePasswordForm);
	this.shadow.appendChild(changePasswordSection);
};

VaultManagerWidget.prototype.showStatus = function(message, isError) {
	var status = this.document.createElement("div");
	status.className = "vault-status" + (isError ? " error" : "");
	status.textContent = message;
	this.shadow.insertBefore(status, this.shadow.firstChild.nextSibling);
	
	setTimeout(function() {
		status.remove();
	}, 3000);
};

VaultManagerWidget.prototype.fallbackCopy = function(text) {
	var textArea = this.document.createElement("textarea");
	textArea.value = text;
	textArea.style.position = "fixed";
	textArea.style.top = "-9999px";
	this.document.body.appendChild(textArea);
	textArea.select();
	try {
		this.document.execCommand("copy");
		this.showStatus("Secret copied to clipboard!");
	} catch(err) {
		this.showStatus("Failed to copy", true);
	}
	this.document.body.removeChild(textArea);
};

/*
Compute the internal state of the widget
*/
VaultManagerWidget.prototype.execute = function() {
	// Nothing to compute
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
VaultManagerWidget.prototype.refresh = function(changedTiddlers) {
	if(changedTiddlers["$:/secrets/vault"] || changedTiddlers["$:/state/vault/unlocked"] || changedTiddlers["$:/palette"]) {
		if(this.shadow) {
			// Update styles when palette changes
			if(changedTiddlers["$:/palette"]) {
				var styleElement = this.shadow.querySelector("style");
				if(styleElement) {
					styleElement.textContent = this.getStyles();
				}
			}
			// Re-render content for other changes
			if(changedTiddlers["$:/secrets/vault"] || changedTiddlers["$:/state/vault/unlocked"]) {
				this.renderContent();
			}
		}
		return true;
	}
	return false;
};

exports["vault-manager"] = VaultManagerWidget;

})();