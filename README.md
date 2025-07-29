# TiddlyWiki Secrets Vault Plugin

A highly secure secrets vault plugin for TiddlyWiki5 that uses the Web Crypto API and Shadow DOM for maximum security.

## Features

### 🔐 Security First
- **AES-256-GCM** encryption with authenticated encryption
- **PBKDF2-SHA256** key derivation with 600,000 iterations (OWASP 2023)
- **HMAC-SHA256** additional integrity verification
- **Shadow DOM** isolation for sensitive UI components
- **Constant-time** comparison to prevent timing attacks
- **Rate limiting** with lockout after failed attempts

### 💡 User-Friendly
- **WikiText syntax**: `§[secret:name]` to embed secrets
- **Click to reveal** secrets in your tiddlers
- **Ctrl+Click** (Cmd+Click on Mac) to copy without revealing
- **Auto-hide** secrets after configurable timeout (default 8 seconds)
- **Editor toolbar** integration for easy secret insertion
- **Password change** functionality without losing secrets

### 🎨 Adaptive UI
- Automatically adapts to TiddlyWiki color palettes
- Works seamlessly with dark and light themes
- Responsive design for all screen sizes

## Installation

1. Drag and drop the plugin file to your TiddlyWiki
2. Save and reload your wiki
3. The plugin will be available immediately

## Usage

### Initial Setup

1. Go to Control Panel → Secrets Vault (or create a tiddler with `<$vault-manager/>`)
2. Set a strong master password (minimum 8 characters)
3. Click "Initialize Vault"

### Adding Secrets

1. Unlock the vault with your master password
2. Enter a name and value for your secret
3. Click "Add Secret"

### Using Secrets in Tiddlers

To reference a secret in your tiddlers:

```
§[secret:my-api-key]
§[secret:password123]
```

This renders as a locked button:
- **Click** to reveal the secret
- **Ctrl+Click** (Cmd+Click on Mac) to copy directly to clipboard
- Secrets auto-hide after 8 seconds (configurable)

### Editor Toolbar

Use the 🔐 button in the editor toolbar to:
- Browse and insert existing secrets
- Access the vault manager

## Security Implementation

### Encryption Details
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2-SHA256 with 600,000 iterations
- **Salt**: 256-bit cryptographically secure random
- **IV**: 128-bit random initialization vector per encryption
- **Additional**: HMAC-SHA256 for integrity verification

### Security Features
- **Non-extractable keys**: Crypto keys cannot be exported
- **Memory clearing**: Automatic sensitive data cleanup
- **Input sanitization**: Prevents injection attacks
- **Replay protection**: Timestamps in encrypted data
- **Rate limiting**: 5 attempts max, then 5-minute lockout

### Browser Requirements
- Web Crypto API support (all modern browsers)
- Shadow DOM support (recommended, with fallback)
- Works in single-file wikis opened locally (`file://` protocol)
- Also works on HTTPS sites and localhost

## Configuration

### Auto-Hide Timeout
Configure how long secrets remain visible:
- Tiddler: `$:/config/SecretsVault/AutoHideTimeout`
- Default: 8000 milliseconds (8 seconds)

## Technical Details

### Storage
- Secrets stored in `$:/secrets/vault` tiddler fields
- Field format: `secret-[name]` for encrypted data
- Metadata: `secret-meta-[name]` for timestamps
- Version tracking for future migrations

### WikiText Parser
- Custom parser rule for `§[secret:name]` syntax
- Generates secure widget for display

### Widgets
- `<$vault-manager/>` - Full vault management UI
- `<secret name="..."/>` - Display individual secret

## Development

### File Structure
```
plugins/BTC/secrets-vault/
├── plugin.info          # Plugin metadata
├── README.md           # This file
├── readme.tid          # TiddlyWiki documentation
├── secrets-manager.js  # Core encryption logic
├── startup.js          # Plugin initialization
├── parsers/
│   └── secretrule.js   # WikiText parser
├── widgets/
│   ├── secret.js       # Secret display widget
│   ├── vault-manager.js # Management UI widget
│   └── action-vault.js # Action widget
├── ui/                 # UI components
├── language/           # Translations
└── styles.tid          # CSS styles
```

### Building
This plugin follows standard TiddlyWiki plugin structure and can be built using TiddlyWiki's Node.js tools.

## Browser Compatibility

- ✅ Chrome/Edge 79+
- ✅ Firefox 69+
- ✅ Safari 15+
- ✅ Opera 66+
- ✅ Works with local files (`file://`)
- ✅ Works on HTTPS sites
- ✅ Works on localhost

## License

This plugin is part of TiddlyWiki5 and follows the same license terms.

## Credits

- **Author**: Simon Huber
- **Plugin Type**: TiddlyWiki5 Plugin
- **Version**: 2.0.0

## Security Disclosure

If you discover a security vulnerability, please report it to the TiddlyWiki security team.

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Visit the TiddlyWiki community forums
- Check the TiddlyWiki documentation

---

**⚠️ Important**: Always keep backups of your wiki before storing sensitive information. While this plugin uses strong encryption, no system is 100% secure. Use at your own risk for truly sensitive data.