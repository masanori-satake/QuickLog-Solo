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
