/*\
title: $:/plugins/BTC/secrets-vault/secrets-manager.js
type: application/javascript
module-type: utils

Secrets manager using Web Crypto API with maximum security

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

// Security constants
var PBKDF2_ITERATIONS = 600000; // OWASP 2023 recommendation for PBKDF2-SHA256
var SALT_BYTES = 32; // 256 bits of salt
var IV_BYTES = 16; // 128 bits for AES-GCM
var TAG_BYTES = 16; // 128 bits for GCM auth tag
var KEY_BITS = 256; // AES-256
var VERIFICATION_TEXT = "TW5_SECRETS_VAULT_V2_VERIFIED";
var MAX_ATTEMPTS = 5; // Maximum unlock attempts
var LOCKOUT_TIME = 300000; // 5 minutes lockout

function SecretsManager() {
	this.crypto = window.crypto || window.msCrypto;
	this.key = null;
	this.hmacKey = null;
	this.salt = null;
	this.attempts = 0;
	this.lockedUntil = 0;
	this.autoLockTimer = null;
	this.lastActivity = Date.now();
	
	// Secure the crypto object
	if(this.crypto && this.crypto.subtle) {
		try {
			// Prevent modification of crypto methods
			Object.freeze(this.crypto);
			Object.freeze(this.crypto.subtle);
		} catch(e) {
			// Some browsers don't allow freezing
		}
	}
}

SecretsManager.prototype.isAvailable = function() {
	// Enhanced availability check
	try {
		return !!(this.crypto && 
				 this.crypto.subtle && 
				 this.crypto.getRandomValues &&
				 typeof this.crypto.subtle.generateKey === "function" &&
				 typeof this.crypto.subtle.encrypt === "function" &&
				 typeof this.crypto.subtle.decrypt === "function");
	} catch(e) {
		return false;
	}
};

SecretsManager.prototype.constantTimeCompare = function(a, b) {
	// Constant-time comparison to prevent timing attacks
	if(a.length !== b.length) return false;
	var result = 0;
	for(var i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
};

SecretsManager.prototype.generateSalt = function() {
	// Generate cryptographically strong random salt
	var salt = new Uint8Array(SALT_BYTES);
	this.crypto.getRandomValues(salt);
	
	// Add additional entropy from various sources
	var entropyData = [
		Date.now(),
		Math.random() * 1000000,
		performance.now ? performance.now() : 0,
		navigator.userAgent,
		screen.width,
		screen.height
	].join("|");
	
	// Mix additional entropy into salt
	var encoder = new TextEncoder();
	var entropyBytes = encoder.encode(entropyData);
	for(var i = 0; i < Math.min(entropyBytes.length, salt.length); i++) {
		salt[i] ^= entropyBytes[i];
	}
	
	return salt;
};

SecretsManager.prototype.deriveKeys = function(password, salt) {
	var self = this;
	var encoder = new TextEncoder();
	
	// Validate password strength
	if(password.length < 8) {
		return Promise.reject(new Error("Password too short"));
	}
	
	return this.crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		{name: "PBKDF2"},
		false,
		["deriveBits", "deriveKey"]
	).then(function(keyMaterial) {
		// Derive both encryption key and HMAC key
		return Promise.all([
			// Encryption key
			self.crypto.subtle.deriveKey(
				{
					name: "PBKDF2",
					salt: salt,
					iterations: PBKDF2_ITERATIONS,
					hash: "SHA-256"
				},
				keyMaterial,
				{name: "AES-GCM", length: KEY_BITS},
				false, // Non-extractable for security
				["encrypt", "decrypt"]
			),
			// HMAC key for additional integrity
			self.crypto.subtle.deriveKey(
				{
					name: "PBKDF2",
					salt: new Uint8Array([...salt].reverse()), // Different salt for HMAC
					iterations: PBKDF2_ITERATIONS,
					hash: "SHA-256"
				},
				keyMaterial,
				{name: "HMAC", hash: "SHA-256"},
				false,
				["sign", "verify"]
			)
		]);
	});
};

SecretsManager.prototype.encrypt = function(plaintext) {
	var self = this;
	if(!this.key || !this.hmacKey) {
		return Promise.reject(new Error("No key set"));
	}
	
	var encoder = new TextEncoder();
	var iv = new Uint8Array(IV_BYTES);
	this.crypto.getRandomValues(iv);
	
	// Add timestamp to prevent replay attacks
	var timestamp = Date.now().toString();
	var dataToEncrypt = timestamp + "|" + plaintext;
	
	return this.crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv: iv,
			tagLength: TAG_BYTES * 8
		},
		this.key,
		encoder.encode(dataToEncrypt)
	).then(function(encrypted) {
		// Create container with IV + ciphertext
		var encryptedArray = new Uint8Array(encrypted);
		var combined = new Uint8Array(iv.length + encryptedArray.length);
		combined.set(iv);
		combined.set(encryptedArray, iv.length);
		
		// Create HMAC for additional integrity
		return self.crypto.subtle.sign(
			"HMAC",
			self.hmacKey,
			combined
		).then(function(signature) {
			// Combine signature + data
			var sigArray = new Uint8Array(signature);
			var final = new Uint8Array(sigArray.length + combined.length);
			final.set(sigArray);
			final.set(combined, sigArray.length);
			
			return self.arrayBufferToBase64(final.buffer);
		});
	}).catch(function(error) {
		// Clear sensitive data on error
		self.clearSensitiveData();
		throw error;
	});
};

SecretsManager.prototype.decrypt = function(ciphertext) {
	var self = this;
	if(!this.key || !this.hmacKey) {
		return Promise.reject(new Error("No key set"));
	}
	
	try {
		var combined = this.base64ToArrayBuffer(ciphertext);
		var combinedArray = new Uint8Array(combined);
		
		// Extract HMAC signature
		var signature = combinedArray.slice(0, 32); // SHA-256 HMAC = 32 bytes
		var data = combinedArray.slice(32);
		
		// Verify HMAC
		return this.crypto.subtle.verify(
			"HMAC",
			this.hmacKey,
			signature,
			data
		).then(function(valid) {
			if(!valid) {
				throw new Error("Invalid signature");
			}
			
			// Extract IV and ciphertext
			var iv = data.slice(0, IV_BYTES);
			var encrypted = data.slice(IV_BYTES);
			
			return self.crypto.subtle.decrypt(
				{
					name: "AES-GCM",
					iv: iv,
					tagLength: TAG_BYTES * 8
				},
				self.key,
				encrypted
			);
		}).then(function(decrypted) {
			var decoder = new TextDecoder();
			var decryptedText = decoder.decode(decrypted);
			
			// Verify timestamp (allow 24 hours old data)
			var parts = decryptedText.split("|");
			var timestamp = parseInt(parts[0], 10);
			var age = Date.now() - timestamp;
			
			if(age > 86400000) { // 24 hours
				console.warn("Decrypted data is older than 24 hours");
			}
			
			return parts.slice(1).join("|");
		});
	} catch(error) {
		return Promise.reject(new Error("Decryption failed"));
	}
};

SecretsManager.prototype.arrayBufferToBase64 = function(buffer) {
	var binary = '';
	var bytes = new Uint8Array(buffer);
	var len = bytes.byteLength;
	for(var i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
};

SecretsManager.prototype.base64ToArrayBuffer = function(base64) {
	try {
		var binaryString = window.atob(base64);
		var len = binaryString.length;
		var bytes = new Uint8Array(len);
		for(var i = 0; i < len; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	} catch(e) {
		throw new Error("Invalid base64 data");
	}
};

SecretsManager.prototype.clearSensitiveData = function() {
	// Clear keys from memory
	this.key = null;
	this.hmacKey = null;
	
	// Clear auto-lock timer
	if(this.autoLockTimer) {
		clearTimeout(this.autoLockTimer);
		this.autoLockTimer = null;
	}
	
	// Force garbage collection if available
	if(typeof window.gc === "function") {
		window.gc();
	}
};

SecretsManager.prototype.resetAutoLockTimer = function() {
	var self = this;
	
	// Clear existing timer
	if(this.autoLockTimer) {
		clearTimeout(this.autoLockTimer);
	}
	
	// Get timeout value from config (in minutes, default 10)
	var timeoutMinutes = parseInt($tw.wiki.getTiddlerText("$:/config/SecretsVault/AutoLockTimeout", "10"), 10);
	
	// If timeout is 0, auto-lock is disabled
	if(timeoutMinutes === 0 || !this.isUnlocked()) {
		return;
	}
	
	// Convert to milliseconds
	var timeoutMs = timeoutMinutes * 60 * 1000;
	
	// Set new timer
	this.autoLockTimer = setTimeout(function() {
		self.lock();
		// Show notification if TW notifier is available
		if($tw.notifier) {
			$tw.notifier.display("$:/temp/vault-locked", {
				title: "Vault Auto-Locked",
				text: "The secrets vault has been locked due to inactivity"
			});
		}
	}, timeoutMs);
	
	// Update last activity timestamp
	this.lastActivity = Date.now();
};

SecretsManager.prototype.updateActivity = function() {
	// Reset the auto-lock timer on any vault activity
	if(this.isUnlocked()) {
		this.resetAutoLockTimer();
	}
};

SecretsManager.prototype.setPassword = function(password) {
	var self = this;
	
	// Clear any existing keys
	this.clearSensitiveData();
	
	this.salt = this.generateSalt();
	
	return this.deriveKeys(password, this.salt).then(function(keys) {
		self.key = keys[0];
		self.hmacKey = keys[1];
		
		// Create verification string
		return self.encrypt(VERIFICATION_TEXT);
	}).then(function(verification) {
		// Store salt and verification
		var vault = $tw.wiki.getTiddler("$:/secrets/vault") || {};
		$tw.wiki.addTiddler(new $tw.Tiddler(vault, {
			title: "$:/secrets/vault",
			"secrets-salt": self.arrayBufferToBase64(self.salt.buffer),
			"secrets-verification": verification,
			"secrets-version": "2.0"
		}));
		
		// Reset attempt counter
		self.attempts = 0;
		self.lockedUntil = 0;
		
		return true;
	}).catch(function(error) {
		self.clearSensitiveData();
		throw error;
	});
};

SecretsManager.prototype.unlock = function(password) {
	var self = this;
	
	// Check if locked out
	if(Date.now() < this.lockedUntil) {
		var remaining = Math.ceil((this.lockedUntil - Date.now()) / 1000);
		return Promise.reject(new Error("Too many attempts. Try again in " + remaining + " seconds"));
	}
	
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	
	if(!vault || !vault.fields["secrets-salt"] || !vault.fields["secrets-verification"]) {
		return Promise.reject(new Error("Vault not initialized"));
	}
	
	// Clear any existing keys
	this.clearSensitiveData();
	
	try {
		this.salt = new Uint8Array(this.base64ToArrayBuffer(vault.fields["secrets-salt"]));
	} catch(e) {
		return Promise.reject(new Error("Invalid vault data"));
	}
	
	return this.deriveKeys(password, this.salt).then(function(keys) {
		self.key = keys[0];
		self.hmacKey = keys[1];
		// Verify password
		return self.decrypt(vault.fields["secrets-verification"]);
	}).then(function(decrypted) {
		if(self.constantTimeCompare(decrypted, VERIFICATION_TEXT)) {
			// Reset attempts on success
			self.attempts = 0;
			self.lockedUntil = 0;
			// Trigger refresh by touching a state tiddler
			$tw.wiki.addTiddler({title: "$:/state/vault/unlocked", text: "yes"});
			// Start auto-lock timer
			self.resetAutoLockTimer();
			return true;
		} else {
			throw new Error("Invalid password");
		}
	}).catch(function(error) {
		// Increment attempts and potentially lock out
		self.attempts++;
		if(self.attempts >= MAX_ATTEMPTS) {
			self.lockedUntil = Date.now() + LOCKOUT_TIME;
		}
		
		self.clearSensitiveData();
		throw error;
	});
};

SecretsManager.prototype.isUnlocked = function() {
	return !!(this.key && this.hmacKey);
};

SecretsManager.prototype.lock = function() {
	this.clearSensitiveData();
	// Trigger refresh by touching a state tiddler
	$tw.wiki.addTiddler({title: "$:/state/vault/unlocked", text: "no"});
};

SecretsManager.prototype.encodeSecretName = function(name) {
	// Use base64 encoding for field names to support any character
	// Encode to base64url (URL-safe base64) to avoid issues with + and /
	var base64 = btoa(unescape(encodeURIComponent(name)));
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

SecretsManager.prototype.decodeSecretName = function(encodedName) {
	// Decode from base64url back to original name
	// Add back padding if needed
	var base64 = encodedName.replace(/-/g, '+').replace(/_/g, '/');
	var padding = base64.length % 4;
	if(padding) {
		base64 += '='.repeat(4 - padding);
	}
	try {
		return decodeURIComponent(escape(atob(base64)));
	} catch(e) {
		// Fallback for old format (non-encoded names)
		return encodedName;
	}
};

SecretsManager.prototype.addSecret = function(name, value, username, description) {
	var self = this;
	if(!this.isUnlocked()) {
		return Promise.reject(new Error("Vault is locked"));
	}
	
	// Update activity for auto-lock
	this.updateActivity();
	
	// Validate secret name
	if(!name || typeof name !== "string" || name.length === 0) {
		return Promise.reject(new Error("Invalid secret name"));
	}
	
	// Encode the name for use as field key
	var encodedName = this.encodeSecretName(name);
	
	// Check if secret already exists
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	if(vault && (vault.fields["secret-" + encodedName] || vault.fields["secret-" + name])) {
		return Promise.reject(new Error("A secret with the name '" + name + "' already exists"));
	}
	
	// Encrypt secret, username, and description if provided
	var encryptPromises = [this.encrypt(value)];
	if(username && username.length > 0) {
		encryptPromises.push(this.encrypt(username));
	} else {
		encryptPromises.push(Promise.resolve(null));
	}
	if(description && description.length > 0) {
		encryptPromises.push(this.encrypt(description));
	} else {
		encryptPromises.push(Promise.resolve(null));
	}
	
	return Promise.all(encryptPromises).then(function(encrypted) {
		var vault = $tw.wiki.getTiddler("$:/secrets/vault") || {};
		var fields = Object.assign({}, vault.fields);
		fields["secret-" + encodedName] = encrypted[0];
		fields["meta-" + encodedName] = JSON.stringify({
			created: Date.now(),
			modified: Date.now(),
			originalName: name // Store original name for display
		});
		// Store encrypted username if provided
		if(encrypted[1]) {
			fields["username-" + encodedName] = encrypted[1];
		}
		// Store encrypted description if provided
		if(encrypted[2]) {
			fields["description-" + encodedName] = encrypted[2];
		}
		$tw.wiki.addTiddler(new $tw.Tiddler(vault, fields));
		return true;
	});
};

SecretsManager.prototype.getSecret = function(name) {
	if(!this.isUnlocked()) {
		return Promise.reject(new Error("Vault is locked"));
	}
	
	// Update activity for auto-lock
	this.updateActivity();
	
	// Encode the name for field lookup
	var encodedName = this.encodeSecretName(name);
	
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	if(!vault) {
		return Promise.reject(new Error("Secret not found"));
	}
	
	// Try encoded name first, fall back to old format
	var secretField = vault.fields["secret-" + encodedName] || vault.fields["secret-" + name];
	if(!secretField) {
		return Promise.reject(new Error("Secret not found"));
	}
	
	return this.decrypt(secretField);
};

SecretsManager.prototype.getUsername = function(name) {
	if(!this.isUnlocked()) {
		return Promise.reject(new Error("Vault is locked"));
	}
	
	// Update activity for auto-lock
	this.updateActivity();
	
	// Encode the name for field lookup
	var encodedName = this.encodeSecretName(name);
	
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	if(!vault) {
		return Promise.resolve(""); // Return empty string if no username
	}
	
	// Try encoded name first, fall back to old format
	var usernameField = vault.fields["username-" + encodedName] || vault.fields["username-" + name];
	if(!usernameField) {
		return Promise.resolve(""); // Return empty string if no username
	}
	
	// Try to decrypt - if it fails, it's probably plain text (old format)
	return this.decrypt(usernameField).catch(function() {
		// If decryption fails, return as plain text (for backward compatibility)
		return usernameField;
	});
};

SecretsManager.prototype.getDescription = function(name) {
	if(!this.isUnlocked()) {
		return Promise.reject(new Error("Vault is locked"));
	}
	
	// Update activity for auto-lock
	this.updateActivity();
	
	// Encode the name for field lookup
	var encodedName = this.encodeSecretName(name);
	
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	if(!vault) {
		return Promise.resolve(""); // Return empty string if no description
	}
	
	// Try encoded name first, fall back to old format
	var descriptionField = vault.fields["description-" + encodedName] || vault.fields["description-" + name];
	if(!descriptionField) {
		return Promise.resolve(""); // Return empty string if no description
	}
	
	return this.decrypt(descriptionField);
};

SecretsManager.prototype.listSecrets = function() {
	// Update activity for auto-lock if unlocked
	if(this.isUnlocked()) {
		this.updateActivity();
	}
	
	var self = this;
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	if(!vault) {
		return [];
	}
	
	var secrets = [];
	var processedKeys = {}; // Track processed keys to avoid duplicates
	
	$tw.utils.each(vault.fields, function(value, fieldName) {
		if(fieldName.indexOf("secret-") === 0) {
			var encodedName = fieldName.substring(7);
			
			// Skip if we've already processed this secret
			if(processedKeys[encodedName]) {
				return;
			}
			processedKeys[encodedName] = true;
			
			// Check if there's metadata with the original name
			var metaField = vault.fields["meta-" + encodedName];
			if(metaField) {
				try {
					var meta = JSON.parse(metaField);
					if(meta.originalName) {
						secrets.push(meta.originalName);
						return;
					}
				} catch(e) {
					// Fall through to decoding
				}
			}
			
			// Try to decode the name
			var decodedName = self.decodeSecretName(encodedName);
			secrets.push(decodedName);
		}
	});
	return secrets;
};

SecretsManager.prototype.updateSecret = function(name, value, username, description) {
	var self = this;
	if(!this.isUnlocked()) {
		return Promise.reject(new Error("Vault is locked"));
	}
	
	// Update activity for auto-lock
	this.updateActivity();
	
	// Encode the name for field lookup
	var encodedName = this.encodeSecretName(name);
	
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	if(!vault) {
		return Promise.reject(new Error("Secret not found"));
	}
	
	// Check if secret exists (try both encoded and old format)
	var secretField = vault.fields["secret-" + encodedName] || vault.fields["secret-" + name];
	if(!secretField) {
		return Promise.reject(new Error("Secret not found"));
	}
	
	// Determine which format is being used
	var fieldKey = vault.fields["secret-" + encodedName] ? encodedName : name;
	
	// Encrypt the new values
	var encryptPromises = [this.encrypt(value)];
	if(username !== undefined) {
		if(username && username.length > 0) {
			encryptPromises.push(this.encrypt(username));
		} else {
			encryptPromises.push(Promise.resolve(null));
		}
	} else {
		encryptPromises.push(Promise.resolve(undefined)); // Keep existing
	}
	
	if(description !== undefined) {
		if(description && description.length > 0) {
			encryptPromises.push(this.encrypt(description));
		} else {
			encryptPromises.push(Promise.resolve(null));
		}
	} else {
		encryptPromises.push(Promise.resolve(undefined)); // Keep existing
	}
	
	return Promise.all(encryptPromises).then(function(encrypted) {
		var fields = Object.assign({}, vault.fields);
		
		// Update secret value
		fields["secret-" + fieldKey] = encrypted[0];
		
		// Update metadata
		var metaField = fields["meta-" + fieldKey];
		var meta = {};
		if(metaField) {
			try {
				meta = JSON.parse(metaField);
			} catch(e) {
				meta = {created: Date.now()};
			}
		} else {
			meta = {created: Date.now()};
		}
		meta.modified = Date.now();
		if(fieldKey === encodedName && name !== encodedName) {
			meta.originalName = name; // Store original name for encoded fields
		}
		fields["meta-" + fieldKey] = JSON.stringify(meta);
		
		// Update username if provided
		if(encrypted[1] !== undefined) {
			if(encrypted[1]) {
				fields["username-" + fieldKey] = encrypted[1];
			} else {
				delete fields["username-" + fieldKey];
			}
		}
		
		// Update description if provided
		if(encrypted[2] !== undefined) {
			if(encrypted[2]) {
				fields["description-" + fieldKey] = encrypted[2];
			} else {
				delete fields["description-" + fieldKey];
			}
		}
		
		$tw.wiki.addTiddler(new $tw.Tiddler(fields));
		return true;
	});
};

SecretsManager.prototype.deleteSecret = function(name) {
	if(!this.isUnlocked()) {
		return Promise.reject(new Error("Vault is locked"));
	}
	
	// Update activity for auto-lock
	this.updateActivity();
	
	// Encode the name for field lookup
	var encodedName = this.encodeSecretName(name);
	
	var vault = $tw.wiki.getTiddler("$:/secrets/vault");
	if(!vault) {
		return Promise.reject(new Error("Secret not found"));
	}
	
	// Check both encoded and old format
	var hasSecret = vault.fields["secret-" + encodedName] || vault.fields["secret-" + name];
	if(!hasSecret) {
		return Promise.reject(new Error("Secret not found"));
	}
	
	var fields = Object.assign({}, vault.fields);
	// Delete all related fields (try both encoded and old format)
	["secret-", "meta-", "username-", "description-"].forEach(function(prefix) {
		delete fields[prefix + encodedName];
		delete fields[prefix + name]; // Also try old format
	});
	
	// Create a new tiddler with only the remaining fields
	$tw.wiki.addTiddler(new $tw.Tiddler(fields));
	
	// Clear from memory
	if(typeof window.gc === "function") {
		window.gc();
	}
	
	return Promise.resolve(true);
};

SecretsManager.prototype.changePassword = function(oldPassword, newPassword) {
	var self = this;
	if(!this.isUnlocked()) {
		return Promise.reject(new Error("Vault is locked"));
	}
	
	// Validate new password
	if(newPassword.length < 8) {
		return Promise.reject(new Error("New password too short"));
	}
	
	// Variables to hold secrets and metadata across promise chain
	var secrets = {};
	var usernames = {};
	var metadata = {};
	
	// First verify the old password
	return this.unlock(oldPassword).then(function() {
		// Get all secrets before changing the password
		var vault = $tw.wiki.getTiddler("$:/secrets/vault");
		
		// Decrypt all secrets, usernames, and descriptions with old key
		var decryptPromises = [];
		var descriptions = {};
		$tw.utils.each(vault.fields, function(value, name) {
			if(name.indexOf("secret-") === 0 && name.indexOf("secret-meta-") !== 0) {
				decryptPromises.push(
					self.decrypt(value).then(function(decrypted) {
						secrets[name.substring(7)] = decrypted;
					})
				);
			} else if(name.indexOf("username-") === 0) {
				// Try to decrypt username - if it fails, it's plain text
				decryptPromises.push(
					self.decrypt(value).then(function(decrypted) {
						usernames[name.substring(9)] = decrypted;
					}).catch(function() {
						// Plain text username (old format)
						usernames[name.substring(9)] = value;
					})
				);
			} else if(name.indexOf("description-") === 0) {
				// Decrypt descriptions
				decryptPromises.push(
					self.decrypt(value).then(function(decrypted) {
						descriptions[name.substring(12)] = decrypted;
					})
				);
			} else if(name.indexOf("meta-") === 0) {
				metadata[name] = value;
			}
		});
		
		return Promise.all(decryptPromises);
	}).then(function() {
		// Set new password
		self.clearSensitiveData();
		self.salt = self.generateSalt();
		return self.deriveKeys(newPassword, self.salt);
	}).then(function(keys) {
		self.key = keys[0];
		self.hmacKey = keys[1];
		
		// Re-encrypt all secrets with new key
		var encryptPromises = [];
		var newFields = {
			title: "$:/secrets/vault",
			"secrets-salt": self.arrayBufferToBase64(self.salt.buffer),
			"secrets-version": "2.0"
		};
		
		// Restore metadata
		$tw.utils.each(metadata, function(value, name) {
			newFields[name] = value;
		});
		
		// Create new verification
		return self.encrypt(VERIFICATION_TEXT).then(function(verification) {
			newFields["secrets-verification"] = verification;
			
			// Re-encrypt all secrets
			$tw.utils.each(secrets, function(value, name) {
				encryptPromises.push(
					self.encrypt(value).then(function(encrypted) {
						newFields["secret-" + name] = encrypted;
						// Update modified time in metadata
						var metaKey = "meta-" + name;
						if(newFields[metaKey]) {
							try {
								var meta = JSON.parse(newFields[metaKey]);
								meta.modified = Date.now();
								newFields[metaKey] = JSON.stringify(meta);
							} catch(e) {
								// Keep existing metadata if parse fails
							}
						}
					})
				);
			});
			
			// Re-encrypt all usernames
			$tw.utils.each(usernames, function(value, name) {
				encryptPromises.push(
					self.encrypt(value).then(function(encrypted) {
						newFields["username-" + name] = encrypted;
					})
				);
			});
			
			// Re-encrypt all descriptions
			$tw.utils.each(descriptions, function(value, name) {
				encryptPromises.push(
					self.encrypt(value).then(function(encrypted) {
						newFields["description-" + name] = encrypted;
					})
				);
			});
			
			return Promise.all(encryptPromises);
		}).then(function() {
			// Save the vault with new encryption
			$tw.wiki.addTiddler(new $tw.Tiddler(newFields));
			return true;
		});
	}).catch(function(error) {
		self.clearSensitiveData();
		throw error;
	});
};

// Export the constructor
exports.SecretsManager = SecretsManager;

})();