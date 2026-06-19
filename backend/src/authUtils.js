/**
 * Auth utilities for PKCE (Proof Key for Code Exchange)
 * Used for Airwallex SDK authorization flow
 */
import crypto from 'crypto';

/**
 * Generate a random code verifier for PKCE
 * @returns {string} A base64url encoded random string
 */
export function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate a code challenge from the verifier using SHA256
 * @param {string} verifier - The code verifier
 * @returns {Promise<string>} A base64url encoded SHA256 hash
 */
export async function generateCodeChallengeFromVerifier(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}
