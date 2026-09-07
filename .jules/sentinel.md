# Sentinel's Journal - Critical Security Learnings

## 2026-04-03 - CSPRNG Fallback in Secure & Non-Secure Browsing Contexts
**Vulnerability:** `crypto.randomUUID` is restricted to secure contexts (HTTPS/localhost). In non-secure contexts or older engines, relying solely on `Math.random()` for fallback UUID generation produces predictable identifiers susceptible to collision or enumeration.
**Learning:** `crypto.getRandomValues()` is often available even when `crypto.randomUUID` is not supported.
**Prevention:** Implement a layered fallback mechanism in `generateUUID()`: try `crypto.randomUUID()` first, then `crypto.getRandomValues()` with explicit RFC 4122 v4 bit manipulation, and only use `Math.random()` as a final resort.
