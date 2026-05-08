// Deterministic viewer_hash = sha256(email.toLowerCase().trim()) — D78-C / D2 contract.
// Stored in localStorage per campaign so QA rate-limit sticks across sessions.

const KEY = (campaignId: string) => `ekko_viewer_hash_${campaignId}`;
const EMAIL_KEY = (campaignId: string) => `ekko_viewer_email_${campaignId}`;

export async function deriveViewerHash(email: string): Promise<string> {
  const norm = email.toLowerCase().trim();
  const buf = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function readViewer(campaignId: string): { hash: string | null; email: string | null } {
  try {
    return {
      hash: localStorage.getItem(KEY(campaignId)),
      email: localStorage.getItem(EMAIL_KEY(campaignId)),
    };
  } catch {
    return { hash: null, email: null };
  }
}

export async function persistViewer(campaignId: string, email: string): Promise<string> {
  const hash = await deriveViewerHash(email);
  try {
    localStorage.setItem(KEY(campaignId), hash);
    localStorage.setItem(EMAIL_KEY(campaignId), email.toLowerCase().trim());
  } catch {
    /* ignore */
  }
  return hash;
}
