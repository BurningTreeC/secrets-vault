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
	var buttonBackgroundColor = paletteData["button-background"] || primaryColor;
	var buttonForegroundColor = paletteData["button-foreground"] || (this.isColorDark(buttonBackgroundColor) ? "#ffffff" : "#000000");
	
	return [
		":host { display: block; padding: 1em; background: " + backgroundColor + "; color: " + foregroundColor + "; }",
		".vault-section { margin-bottom: 2em; }",
		".vault-title { font-size: 1.2em; font-weight: bold; margin-bottom: 0.5em; }",
		".vault-status { padding: 0.5em; background: " + notificationBackgroundColor + "; border-radius: 4px; margin-bottom: 1em; }",
		".vault-status.error { background: #ffebee; }",
		".vault-status small { display: block; margin-top: 0.25em; opacity: 0.8; }",
		".vault-form { display: flex; flex-direction: column; gap: 0.5em; max-width: 300px; }",
		".password-wrapper { position: relative; display: flex; align-items: center; }",
		".password-wrapper input { padding-right: 2.5em; }",
		"input { padding: 0.5em; border: 1px solid " + tableBorderColor + "; border-radius: 3px; background: " + backgroundColor + "; color: " + foregroundColor + "; width: 100%; box-sizing: border-box; }",
		"input:disabled { opacity: 0.5; cursor: not-allowed; }",
		".toggle-password { position: absolute; right: 0.5em; background: none; border: none; cursor: pointer; padding: 0.25em; color: " + mutedForegroundColor + "; }",
		".toggle-password:hover { color: " + foregroundColor + "; }",
		"button { ",
		"  padding: 0.5em 1em;",
		"  background: " + buttonBackgroundColor + ";",
		"  color: " + buttonForegroundColor + ";",
		"  border: none;",
		"  border-radius: 3px;",
		"  cursor: pointer;",
		"}",
		"button:hover { opacity: 0.8; }",
		"button:active { opacity: 0.6; }",
		"button:disabled { opacity: 0.5; cursor: not-allowed; }",
		"button:disabled:hover { opacity: 0.5; }",
		"button.danger { background: #dc3545; }",
		"button.danger:hover { opacity: 0.8; }",
		".secrets-table { width: 100%; border-collapse: collapse; margin-top: 1em; table-layout: fixed; }",
		".secrets-table th { text-align: left; padding: 0.5em; background: " + tableHeaderBackgroundColor + "; }",
		".secrets-table th:first-child { width: 25%; }",
		".secrets-table th:nth-child(2) { width: 20%; }",
		".secrets-table th:nth-child(3) { width: 25%; }",
		".secrets-table th:nth-child(4) { width: 15%; }",
		".secrets-table th:last-child { width: 15%; text-align: right; }",
		".secrets-table td { padding: 0.5em; border-bottom: 1px solid " + tableBorderColor + "; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
		".secrets-table td:last-child { text-align: right; }",
		".table-buttons { display: inline-flex; gap: 0.25em; justify-content: flex-end; }",
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
	
	// Handle paste events to ensure they work in Shadow DOM
	input.addEventListener('paste', function(e) {
		e.stopPropagation();
		// Let the default paste behavior happen
	}, true);
	
	// Also handle cut and copy for consistency
	input.addEventListener('cut', function(e) {
		e.stopPropagation();
	}, true);
	
	input.addEventListener('copy', function(e) {
		e.stopPropagation();
	}, true);
	
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
	
	// Check if currently locked out
	if($tw.secretsManager && $tw.secretsManager.lockedUntil && Date.now() < $tw.secretsManager.lockedUntil) {
		var remainingSeconds = Math.ceil(($tw.secretsManager.lockedUntil - Date.now()) / 1000);
		var remainingMinutes = Math.ceil(remainingSeconds / 60);
		var lockoutWarning = this.document.createElement("div");
		lockoutWarning.className = "vault-status error";
		lockoutWarning.innerHTML = "🔒 <strong>Vault is locked</strong><br>";
		if(remainingSeconds < 60) {
			lockoutWarning.innerHTML += "Too many failed attempts. Please wait " + remainingSeconds + " seconds before trying again.";
		} else {
			lockoutWarning.innerHTML += "Too many failed attempts. Please wait " + remainingMinutes + " minute" + (remainingMinutes > 1 ? "s" : "") + " before trying again.";
		}
		section.appendChild(lockoutWarning);
		
		// Auto-refresh the display every second during lockout
		setTimeout(function() {
			self.renderContent();
		}, 1000);
	}
	// Show remaining attempts if any failed attempts but not locked out
	else if($tw.secretsManager && $tw.secretsManager.attempts > 0) {
		var remainingAttempts = 5 - $tw.secretsManager.attempts; // MAX_ATTEMPTS = 5
		var attemptsWarning = this.document.createElement("div");
		attemptsWarning.className = "vault-status error";
		if(remainingAttempts > 0) {
			attemptsWarning.textContent = "⚠️ " + remainingAttempts + " attempt" + (remainingAttempts > 1 ? "s" : "") + " remaining before lockout";
			if(remainingAttempts <= 2) {
				attemptsWarning.innerHTML += "<br><small>After lockout, you'll need to wait 5 minutes before trying again.</small>";
			}
		}
		section.appendChild(attemptsWarning);
	}
	
	var form = this.document.createElement("div");
	form.className = "vault-form";
	
	var passwordField = this.createPasswordInput("Enter master password");
	var passwordInput = passwordField.input;
	form.appendChild(passwordField.wrapper);
	
	var button = this.document.createElement("button");
	button.textContent = "Unlock";
	
	// Disable inputs during lockout
	var isLockedOut = $tw.secretsManager && $tw.secretsManager.lockedUntil && Date.now() < $tw.secretsManager.lockedUntil;
	if(isLockedOut) {
		passwordInput.disabled = true;
		button.disabled = true;
		button.style.opacity = "0.5";
		button.style.cursor = "not-allowed";
	}
	
	var unlockSubmit = function() {
		if($tw.secretsManager) {
			$tw.secretsManager.unlock(passwordInput.value).then(function() {
				self.showStatus("Vault unlocked!");
				passwordInput.value = "";
				self.renderContent();
			}).catch(function(error) {
				passwordInput.value = "";
				// Check if it's a lockout message
				if(error.message.includes("Too many attempts")) {
					self.showStatus(error.message, true);
				} else {
					var remainingAttempts = 5 - $tw.secretsManager.attempts;
					if(remainingAttempts > 0) {
						var message = "Invalid password. " + remainingAttempts + " attempt" + (remainingAttempts > 1 ? "s" : "") + " remaining";
						if(remainingAttempts <= 2) {
							message += " before 5-minute lockout";
						}
						self.showStatus(message, true);
					} else {
						self.showStatus("Too many failed attempts. Please wait 5 minutes.", true);
					}
				}
				// Re-render to update the attempts warning
				self.renderContent();
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
	
	// Initialize search filter state if not already present
	if(!this.searchFilter) {
		this.searchFilter = "";
	}
	
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
	// Handle paste events
	nameInput.addEventListener('paste', function(e) {
		e.stopPropagation();
	}, true);
	nameInput.addEventListener('cut', function(e) {
		e.stopPropagation();
	}, true);
	nameInput.addEventListener('copy', function(e) {
		e.stopPropagation();
	}, true);
	addForm.appendChild(nameInput);
	
	var usernameInput = this.document.createElement("input");
	usernameInput.type = "text";
	usernameInput.placeholder = "Username (optional)";
	// Handle paste events
	usernameInput.addEventListener('paste', function(e) {
		e.stopPropagation();
	}, true);
	usernameInput.addEventListener('cut', function(e) {
		e.stopPropagation();
	}, true);
	usernameInput.addEventListener('copy', function(e) {
		e.stopPropagation();
	}, true);
	addForm.appendChild(usernameInput);
	
	var descriptionInput = this.document.createElement("input");
	descriptionInput.type = "text";
	descriptionInput.placeholder = "Description (optional)";
	// Handle paste events
	descriptionInput.addEventListener('paste', function(e) {
		e.stopPropagation();
	}, true);
	descriptionInput.addEventListener('cut', function(e) {
		e.stopPropagation();
	}, true);
	descriptionInput.addEventListener('copy', function(e) {
		e.stopPropagation();
	}, true);
	addForm.appendChild(descriptionInput);
	
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
		
		// Provide feedback about special characters but don't strip them
		var specialCharsInName = nameInput.value.match(/[^\w\s-]/g);
		if(specialCharsInName && specialCharsInName.length > 0) {
			self.showStatus("Note: Secret name contains special characters. These will be encoded for storage.", false);
		}
		
		if($tw.secretsManager) {
			// Pass username and description to addSecret method
			$tw.secretsManager.addSecret(nameInput.value, valueInput.value, usernameInput.value, descriptionInput.value).then(function() {
				self.showStatus("Secret added successfully!");
				nameInput.value = "";
				usernameInput.value = "";
				descriptionInput.value = "";
				valueInput.value = "";
				self.updateSecretsList();
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
	usernameInput.onkeypress = function(e) {
		if(e.key === "Enter") {
			addSecretSubmit();
		}
	};
	descriptionInput.onkeypress = function(e) {
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
	
	// Add search input
	var searchWrapper = this.document.createElement("div");
	searchWrapper.style.marginBottom = "1em";
	
	var searchInput = this.document.createElement("input");
	searchInput.type = "text";
	searchInput.placeholder = "Search by name, username, or description...";
	searchInput.value = this.searchFilter;
	searchInput.style.width = "100%";
	searchInput.style.maxWidth = "400px";
	
	// Handle paste events
	searchInput.addEventListener('paste', function(e) {
		e.stopPropagation();
	}, true);
	searchInput.addEventListener('cut', function(e) {
		e.stopPropagation();
	}, true);
	searchInput.addEventListener('copy', function(e) {
		e.stopPropagation();
	}, true);
	
	// Handle search input changes
	searchInput.oninput = function() {
		self.searchFilter = searchInput.value;
		self.updateSecretsList();
	};
	
	searchWrapper.appendChild(searchInput);
	listSection.appendChild(searchWrapper);
	
	// Create a container for the secrets table that we can update
	var secretsContainer = this.document.createElement("div");
	secretsContainer.id = "secrets-container";
	listSection.appendChild(secretsContainer);
	
	// Store references for later use
	this.secretsContainer = secretsContainer;
	
	this.shadow.appendChild(listSection);
	
	// Render the secrets list
	this.updateSecretsList();
	
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
	
	// Auto-lock settings section
	var autoLockSection = this.document.createElement("div");
	autoLockSection.className = "vault-section";
	
	var autoLockTitle = this.document.createElement("div");
	autoLockTitle.className = "vault-title";
	autoLockTitle.textContent = "Security Settings";
	autoLockSection.appendChild(autoLockTitle);
	
	var autoLockForm = this.document.createElement("div");
	autoLockForm.className = "vault-form";
	
	// Auto-lock timeout setting
	var autoLockSubtitle = this.document.createElement("div");
	autoLockSubtitle.style.fontWeight = "bold";
	autoLockSubtitle.style.marginBottom = "0.5em";
	autoLockSubtitle.textContent = "Auto-lock Timeout";
	autoLockForm.appendChild(autoLockSubtitle);
	
	// Get current timeout value
	var currentTimeout = parseInt($tw.wiki.getTiddlerText("$:/config/SecretsVault/AutoLockTimeout", "10"), 10);
	
	var timeoutLabel = this.document.createElement("label");
	timeoutLabel.textContent = "Auto-lock timeout (minutes, 0 to disable):";
	autoLockForm.appendChild(timeoutLabel);
	
	var timeoutInput = this.document.createElement("input");
	timeoutInput.type = "number";
	timeoutInput.min = "0";
	timeoutInput.max = "1440"; // Max 24 hours
	timeoutInput.value = currentTimeout;
	timeoutInput.placeholder = "Minutes (0 to disable)";
	// Handle paste events
	timeoutInput.addEventListener('paste', function(e) {
		e.stopPropagation();
	}, true);
	timeoutInput.addEventListener('cut', function(e) {
		e.stopPropagation();
	}, true);
	timeoutInput.addEventListener('copy', function(e) {
		e.stopPropagation();
	}, true);
	autoLockForm.appendChild(timeoutInput);
	
	var saveTimeoutButton = this.document.createElement("button");
	saveTimeoutButton.textContent = "Save Auto-lock Settings";
	saveTimeoutButton.onclick = function() {
		var newTimeout = parseInt(timeoutInput.value, 10);
		if(isNaN(newTimeout) || newTimeout < 0) {
			self.showStatus("Invalid timeout value", true);
			return;
		}
		
		// Save the new timeout value
		$tw.wiki.addTiddler({
			title: "$:/config/SecretsVault/AutoLockTimeout",
			text: newTimeout.toString()
		});
		
		// Reset the timer with new value
		if($tw.secretsManager && $tw.secretsManager.isUnlocked()) {
			$tw.secretsManager.resetAutoLockTimer();
		}
		
		self.showStatus("Auto-lock timeout updated to " + (newTimeout === 0 ? "disabled" : newTimeout + " minutes"));
	};
	
	autoLockForm.appendChild(saveTimeoutButton);
	
	// Auto-hide timeout setting for displayed secrets
	var autoHideLabel = this.document.createElement("label");
	autoHideLabel.style.marginTop = "1em";
	autoHideLabel.textContent = "Auto-hide displayed secrets after (seconds, 0 to disable):";
	autoLockForm.appendChild(autoHideLabel);
	
	// Get current auto-hide timeout value (convert from ms to seconds)
	var currentAutoHideMs = parseInt($tw.wiki.getTiddlerText("$:/config/SecretsVault/AutoHideTimeout", "8000"), 10);
	var currentAutoHideSeconds = Math.round(currentAutoHideMs / 1000);
	
	var autoHideInput = this.document.createElement("input");
	autoHideInput.type = "number";
	autoHideInput.min = "0";
	autoHideInput.max = "300"; // Max 5 minutes
	autoHideInput.value = currentAutoHideSeconds;
	autoHideInput.placeholder = "Seconds (0 to disable)";
	// Handle paste events
	autoHideInput.addEventListener('paste', function(e) {
		e.stopPropagation();
	}, true);
	autoHideInput.addEventListener('cut', function(e) {
		e.stopPropagation();
	}, true);
	autoHideInput.addEventListener('copy', function(e) {
		e.stopPropagation();
	}, true);
	autoLockForm.appendChild(autoHideInput);
	
	var saveAutoHideButton = this.document.createElement("button");
	saveAutoHideButton.textContent = "Save Auto-Hide Settings";
	saveAutoHideButton.onclick = function() {
		var newAutoHideSeconds = parseInt(autoHideInput.value, 10);
		if(isNaN(newAutoHideSeconds) || newAutoHideSeconds < 0) {
			self.showStatus("Invalid timeout value", true);
			return;
		}
		
		// Convert seconds to milliseconds and save
		var newAutoHideMs = newAutoHideSeconds * 1000;
		$tw.wiki.addTiddler({
			title: "$:/config/SecretsVault/AutoHideTimeout",
			text: newAutoHideMs.toString()
		});
		
		self.showStatus("Auto-hide timeout updated to " + (newAutoHideSeconds === 0 ? "disabled" : newAutoHideSeconds + " seconds"));
	};
	
	autoLockForm.appendChild(saveAutoHideButton);
	autoLockSection.appendChild(autoLockForm);
	this.shadow.appendChild(autoLockSection);
};

VaultManagerWidget.prototype.updateSecretsList = function() {
	var self = this;
	
	// Cancel any pending update
	if(this.updateSecretsListPromise) {
		this.updateSecretsListCancelled = true;
	}
	
	// Clear the container
	if(this.secretsContainer) {
		this.secretsContainer.innerHTML = "";
	}
	
	var secrets = $tw.secretsManager ? $tw.secretsManager.listSecrets() : [];
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	
	// Create maps to store decrypted usernames and descriptions
	var usernamePromises = {};
	var descriptionPromises = {};
	var usernameCache = {};
	var descriptionCache = {};
	
	// Start decrypting all usernames and descriptions
	secrets.forEach(function(secret) {
		usernamePromises[secret] = $tw.secretsManager.getUsername(secret).then(function(username) {
			usernameCache[secret] = username;
			return username;
		}).catch(function() {
			usernameCache[secret] = "";
			return "";
		});
		
		descriptionPromises[secret] = $tw.secretsManager.getDescription(secret).then(function(description) {
			descriptionCache[secret] = description;
			return description;
		}).catch(function() {
			descriptionCache[secret] = "";
			return "";
		});
	});
	
	// Mark this update as not cancelled
	this.updateSecretsListCancelled = false;
	
	// Wait for all usernames and descriptions to be decrypted before filtering
	var allPromises = Object.values(usernamePromises).concat(Object.values(descriptionPromises));
	this.updateSecretsListPromise = Promise.all(allPromises).then(function() {
		// Check if this update was cancelled
		if(self.updateSecretsListCancelled) {
			return;
		}
		
		// Filter secrets based on search input
		if(self.searchFilter) {
			var filter = self.searchFilter.toLowerCase();
			secrets = secrets.filter(function(secret) {
				var secretNameMatch = secret.toLowerCase().includes(filter);
				var username = usernameCache[secret] || "";
				var usernameMatch = username.toLowerCase().includes(filter);
				var description = descriptionCache[secret] || "";
				var descriptionMatch = description.toLowerCase().includes(filter);
				return secretNameMatch || usernameMatch || descriptionMatch;
			});
		}
		
		// Continue with rendering the filtered list
		self.renderSecretsList(secrets, usernameCache, descriptionCache);
		self.updateSecretsListPromise = null;
	});
};

VaultManagerWidget.prototype.renderSecretsList = function(secrets, usernameCache, descriptionCache) {
	var self = this;
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	
	// Clear the container again to prevent duplication
	if(this.secretsContainer) {
		this.secretsContainer.innerHTML = "";
	}
	
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
		var usernameHeader = this.document.createElement("th");
		usernameHeader.textContent = "Username";
		var descriptionHeader = this.document.createElement("th");
		descriptionHeader.textContent = "Description";
		var createdHeader = this.document.createElement("th");
		createdHeader.textContent = "Created";
		var actionsHeader = this.document.createElement("th");
		actionsHeader.textContent = "Actions";
		headerRow.appendChild(nameHeader);
		headerRow.appendChild(usernameHeader);
		headerRow.appendChild(descriptionHeader);
		headerRow.appendChild(createdHeader);
		headerRow.appendChild(actionsHeader);
		thead.appendChild(headerRow);
		table.appendChild(thead);
		
		var tbody = this.document.createElement("tbody");
		secrets.forEach(function(secret) {
			var row = self.document.createElement("tr");
			var nameCell = self.document.createElement("td");
			nameCell.textContent = "🔐 " + secret;
			nameCell.id = "secret-name-" + secret.replace(/\s/g, "-");
			
			// Username cell
			var usernameCell = self.document.createElement("td");
			var username = usernameCache[secret] || "";
			usernameCell.textContent = username;
			
			// Description cell
			var descriptionCell = self.document.createElement("td");
			var description = descriptionCache[secret] || "";
			descriptionCell.textContent = description;
			descriptionCell.title = description; // Show full description on hover
			
			// Created cell
			var createdCell = self.document.createElement("td");
			// Need to encode the secret name to find the metadata
			var encodedName = $tw.secretsManager ? $tw.secretsManager.encodeSecretName(secret) : secret;
			var metaField = vault && (vault.fields["meta-" + encodedName] || vault.fields["meta-" + secret]);
			if(metaField) {
				try {
					var meta = JSON.parse(metaField);
					var created = new Date(meta.created);
					// Format as relative time or date
					var now = new Date();
					var diff = now - created;
					var days = Math.floor(diff / (1000 * 60 * 60 * 24));
					
					if(days === 0) {
						// Today - show time
						var hours = Math.floor(diff / (1000 * 60 * 60));
						if(hours === 0) {
							var minutes = Math.floor(diff / (1000 * 60));
							if(minutes === 0) {
								createdCell.textContent = "Just now";
							} else {
								createdCell.textContent = minutes + " min ago";
							}
						} else {
							createdCell.textContent = hours + " hours ago";
						}
					} else if(days === 1) {
						createdCell.textContent = "Yesterday";
					} else if(days < 7) {
						createdCell.textContent = days + " days ago";
					} else {
						// Show actual date for older items
						createdCell.textContent = created.toLocaleDateString();
					}
					// Add title attribute with full date/time
					createdCell.title = created.toLocaleString();
				} catch(e) {
					createdCell.textContent = "-";
				}
			} else {
				createdCell.textContent = "-";
			}
			
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
						var nameElement = self.shadow.getElementById("secret-name-" + secretName.replace(/\s/g, "-"));
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
								// Auto-hide after configured timeout
								var autoHideTimeout = parseInt($tw.wiki.getTiddlerText("$:/config/SecretsVault/AutoHideTimeout", "8000"), 10);
								if(autoHideTimeout > 0) {
									setTimeout(function() {
										if(nameElement.dataset.showing === "value") {
											nameElement.textContent = "🔐 " + secretName;
											nameElement.dataset.showing = "name";
											viewBtn.textContent = "View";
										}
									}, autoHideTimeout);
								}
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
								self.updateSecretsList();
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
			row.appendChild(usernameCell);
			row.appendChild(descriptionCell);
			row.appendChild(createdCell);
			row.appendChild(actionsCell);
			tbody.appendChild(row);
		});
		table.appendChild(tbody);
		this.secretsContainer.appendChild(table);
	} else {
		var emptyMsg = this.document.createElement("p");
		if(this.searchFilter) {
			emptyMsg.textContent = "No secrets match your search.";
		} else {
			emptyMsg.textContent = "No secrets stored yet.";
		}
		this.secretsContainer.appendChild(emptyMsg);
	}
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
			// Re-render content for state changes
			if(changedTiddlers["$:/state/vault/unlocked"]) {
				this.renderContent();
			}
			// Re-render content when vault changes (including deletion)
			else if(changedTiddlers["$:/secrets/vault"]) {
				// Check if vault was deleted or if it's no longer valid
				var vault = $tw.wiki.getTiddler("$:/secrets/vault");
				if(!vault || !vault.fields["secrets-verification"]) {
					// Vault was deleted or is invalid, re-render everything
					this.renderContent();
				} else if(this.secretsContainer && $tw.secretsManager && $tw.secretsManager.isUnlocked()) {
					// Vault still exists and is unlocked, just update the secrets list
					this.updateSecretsList();
				}
			}
		}
		return true;
	}
	return false;
};

exports["vault-manager"] = VaultManagerWidget;

})();