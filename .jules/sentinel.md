# Sentinel's Journal - Critical Security Learnings

## 2026-04-03 - CSPRNG Fallback in Secure & Non-Secure Browsing Contexts
**Vulnerability:** `crypto.randomUUID` is restricted to secure contexts (HTTPS/localhost). In non-secure contexts or older engines, relying solely on `Math.random()` for fallback UUID generation produces predictable identifiers susceptible to collision or enumeration.
**Learning:** `crypto.getRandomValues()` is often available even when `crypto.randomUUID` is not supported.
**Prevention:** Implement a layered fallback mechanism in `generateUUID()`: try `crypto.randomUUID()` first, then `crypto.getRandomValues()` with explicit RFC 4122 v4 bit manipulation, and only use `Math.random()` as a final resort.

## 2026-04-18 - Replacing Math.random PRNG in Core Client Identifiers
**Vulnerability:** Client IDs (`SETTING_KEY_CLIENT_ID`) and page break internal IDs used `Math.random().toString(36)`, resulting in weakly generated identifiers for session synchronization and conflict resolution.
**Learning:** Legacy initialization routines may inadvertently rely on basic `Math.random()` string concatenations even when a CSPRNG utility (`generateUUID()`) is readily available in the module.
**Prevention:** Always search database initialization and entity creation routines for legacy `Math.random()` patterns and enforce the use of CSPRNG-backed UUID generators.

## 2026-04-20 - Enforcing CSPRNG UUID Generation Across Subprojects & Backup/Restore
**Vulnerability:** Page break entity IDs in `backup.js`, `restore.js`, and `category-editor/js/ui.js` still relied on `Math.random().toString(36)`, creating predictable internal category keys during backup validation, restoration, and UI creation.
**Learning:** Secondary subprojects and backup/restore handlers can retain legacy `Math.random()` patterns even after core database initialization is updated to CSPRNG.
**Prevention:** Periodically audit all entity ID creation sites across subprojects and backup/restore handlers to ensure full migration to CSPRNG `generateUUID()`.

## 2026-05-10 - Eliminating Modulo Bias in CSPRNG PIN Generation for Key Derivation
**Vulnerability:** `generate6DigitPin()` computed `Uint32Array` values modulo 1,000,000, creating modulo bias where lower PIN ranges (000000-967295) had a slightly higher probability (~0.023%) of selection when deriving AES-GCM encryption keys.
**Learning:** Applying simple modulo arithmetic on fixed-width Uint32 integers introduces non-uniform probability distribution across numeric ranges that do not cleanly divide 2^32.
**Prevention:** Always use rejection sampling (e.g. discarding values >= 4,294,000,000) when mapping CSPRNG Uint32 random numbers into numeric ranges.

## 2026-05-18 - Decoupling CSPRNG getRandomValues from SubtleCrypto Requirements
**Vulnerability:** `generate6DigitPin()` relied on `getCrypto()`, which returned `null` whenever `crypto.subtle` was undefined. In non-secure HTTP browsing contexts (where SubtleCrypto is omitted by browsers), this caused PIN generation to fall back to insecure `Math.random()`.
**Learning:** WebCrypto `crypto.subtle` is restricted to secure origins (HTTPS/localhost), whereas `crypto.getRandomValues()` remains available in non-secure HTTP contexts. Requiring `.subtle` when only `.getRandomValues()` is needed unnecessarily downgrades CSPRNG security to PRNG.
**Prevention:** Separate WebCrypto checks: query `crypto.getRandomValues()` directly on the `Crypto` instance (`globalThis.crypto || window.crypto || self.crypto || crypto`) without requiring `crypto.subtle` unless subtle operations (e.g., HMAC, key derivation) are actually needed.

## 2026-05-25 - Guarding WebSocket Input Parsing Against Denial of Service (DoS)
**Vulnerability:** Uncaught `JSON.parse` operations on raw WebSocket `event.data` and stringified `message.data` payloads in `fetchSettingsFromPusher()` caused listener exceptions, immediately closing the WebSocket connection upon receiving malformed or corrupted JSON frames.
**Learning:** Network input parsed over WebSockets or event listeners must be individually wrapped in try-catch blocks and validated for type/structure before processing.
**Prevention:** Wrap each parsing boundary (`JSON.parse(event.data)` and nested `JSON.parse(message.data)`) in isolated try-catch blocks to safely log and discard malformed frames without breaking active event loops or terminating long-lived WebSocket connections.
