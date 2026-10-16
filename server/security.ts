import crypto from 'node:crypto';
import dns from 'node:dns/promises';

// Master key management (separate from ciphertext)
const DATA_DIR = './data';
const MASTER_KEY_PATH = './data/.master_key';

let masterKey: Buffer | null = null;

export function initMasterKey(fs: typeof import('node:fs')): Buffer {
  if (masterKey) return masterKey;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Check if env variable provided or read from dedicated key file
  const envKey = process.env.APP_MASTER_KEY;
  if (envKey && envKey.length === 64) {
    masterKey = Buffer.from(envKey, 'hex');
    return masterKey;
  }

  if (fs.existsSync(MASTER_KEY_PATH)) {
    const raw = fs.readFileSync(MASTER_KEY_PATH, 'utf-8').trim();
    if (raw.length === 64) {
      masterKey = Buffer.from(raw, 'hex');
      return masterKey;
    }
  }

  // Generate a cryptographically strong 256-bit key
  masterKey = crypto.randomBytes(32);
  fs.writeFileSync(MASTER_KEY_PATH, masterKey.toString('hex'), { mode: 0o600 });
  return masterKey;
}

// AES-256-GCM Encryption / Decryption
export interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

export function encryptSecret(plainText: string, key: Buffer): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(plainText, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    iv: iv.toString('hex'),
    tag,
    ciphertext,
  };
}

export function decryptSecret(encrypted: EncryptedPayload, key: Buffer): string {
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Password hashing with PBKDF2 and high iterations
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
}

// Session Token Management (HMAC signed or random high-entropy token)
const activeSessions = new Map<string, { userId: string; role: 'admin' | 'user'; expiresAt: number }>();

export function createSession(userId: string, role: 'admin' | 'user'): string {
  const token = crypto.randomBytes(32).toString('hex');
  // 30 days session
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  activeSessions.set(token, { userId, role, expiresAt });
  return token;
}

export function getSession(token: string): { userId: string; role: 'admin' | 'user' } | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return { userId: session.userId, role: session.role };
}

export function invalidateSession(token: string) {
  activeSessions.delete(token);
}

// SSRF Validation
export async function validateOutboundUrl(rawUrl: string): Promise<{ valid: boolean; error?: string; parsedUrl?: URL }> {
  try {
    const url = new URL(rawUrl);

    // Require HTTPS in production or for general endpoints
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { valid: false, error: 'Protocol must be HTTPS or HTTP' };
    }

    const host = url.hostname.toLowerCase();

    // Check hostnames for loopback / internal metadata
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '::1',
      '0.0.0.0',
      '169.254.169.254',
      'metadata.google.internal',
      'metadata.internal',
      'instance-data',
    ];

    if (blockedHosts.includes(host)) {
      return { valid: false, error: `Access to private or metadata host (${host}) is forbidden.` };
    }

    // IP address checks
    // Check if hostname is an IPv4 literal
    const ipMatch = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const p1 = parseInt(ipMatch[1], 10);
      const p2 = parseInt(ipMatch[2], 10);

      // Loopback 127.0.0.0/8
      if (p1 === 127) return { valid: false, error: 'Loopback address not permitted' };
      // Private 10.0.0.0/8
      if (p1 === 10) return { valid: false, error: 'Private network (10.x.x.x) not permitted' };
      // Private 172.16.0.0/12
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return { valid: false, error: 'Private network (172.16-31.x.x) not permitted' };
      // Private 192.168.0.0/16
      if (p1 === 192 && p2 === 168) return { valid: false, error: 'Private network (192.168.x.x) not permitted' };
      // Link-local / AWS/GCP metadata 169.254.0.0/16
      if (p1 === 169 && p2 === 254) return { valid: false, error: 'Link-local address not permitted' };
      // Carrier grade NAT 100.64.0.0/10
      if (p1 === 100 && p2 >= 64 && p2 <= 127) return { valid: false, error: 'Shared address range not permitted' };
      // Zero network
      if (p1 === 0) return { valid: false, error: 'Invalid IP address' };
    }

    // Resolve DNS to verify it doesn't resolve to internal IP
    try {
      const addresses = await dns.lookup(host, { all: true });
      for (const addr of addresses) {
        const ip = addr.address;
        const resolvedMatch = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (resolvedMatch) {
          const p1 = parseInt(resolvedMatch[1], 10);
          const p2 = parseInt(resolvedMatch[2], 10);
          if (
            p1 === 127 ||
            p1 === 10 ||
            (p1 === 172 && p2 >= 16 && p2 <= 31) ||
            (p1 === 192 && p2 === 168) ||
            (p1 === 169 && p2 === 254) ||
            p1 === 0
          ) {
            return { valid: false, error: `Resolved IP (${ip}) is on a restricted private or loopback subnet.` };
          }
        }
      }
    } catch {
      // If DNS resolution fails here, let the request handler handle network unreachable cleanly
    }

    return { valid: true, parsedUrl: url };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Invalid URL format: ${message}` };
  }
}

// Protected transport headers that cannot be overridden by user configuration
const FORBIDDEN_HEADERS = new Set([
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
  'keep-alive',
]);

export function sanitizeHeaderName(name: string): string | null {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed || FORBIDDEN_HEADERS.has(trimmed)) {
    return null;
  }
  // Allow alphanumeric and dashes
  if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) {
    return null;
  }
  return name.trim();
}
