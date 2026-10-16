import { Router, Request, Response, NextFunction } from 'express';
import { db, UserRecord } from './db.ts';
import {
  createSession,
  getSession,
  invalidateSession,
  verifyPassword,
  validateOutboundUrl,
  sanitizeHeaderName,
} from './security.ts';

export const apiRouter = Router();

// In-flight submission lock to prevent concurrent taps
const inFlightSubmissions = new Set<string>();

// Helper to get nested property from object or set nested property
function setNestedProperty(obj: Record<string, any>, pathStr: string, value: any) {
  const parts = pathStr.split('.').filter(p => p.trim().length > 0);
  if (parts.length === 0) return;
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!curr[part] || typeof curr[part] !== 'object') {
      curr[part] = {};
    }
    curr = curr[part];
  }
  curr[parts[parts.length - 1]] = value;
}

function getNestedProperty(obj: any, pathStr: string): any {
  const parts = pathStr.split('.').filter(p => p.trim().length > 0);
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined;
    }
    curr = curr[part];
  }
  return curr;
}

// Authentication middleware
interface AuthenticatedRequest extends Request {
  user?: UserRecord;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const sessionToken = req.cookies?.['eman_session'] || req.headers['x-session-token'];
  if (!sessionToken || typeof sessionToken !== 'string') {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const session = getSession(sessionToken);
  if (!session) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  const user = db.findUserById(session.userId);
  if (!user || user.disabled) {
    res.status(401).json({ error: 'User account is inactive or disabled.' });
    return;
  }

  req.user = user;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Administrative privileges required.' });
      return;
    }
    next();
  });
}

// -------------------------------------------------------------
// SYSTEM & SETUP
// -------------------------------------------------------------

apiRouter.get('/system/status', (req: Request, res: Response) => {
  const isInit = db.isInitialized();
  res.json({
    initialized: isInit,
    appName: 'Eman QR',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.post('/auth/setup-owner', (req: Request, res: Response) => {
  if (db.isInitialized()) {
    res.status(403).json({ error: 'System already initialized. Initial setup is permanently locked.' });
    return;
  }

  const { name, username, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Please enter a valid administrator name.' });
    return;
  }
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Please enter a valid administrator email.' });
    return;
  }

  try {
    const owner = db.setupOwner(name, username, email, password);
    const sessionToken = createSession(owner.id, owner.role);

    res.cookie('eman_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: {
        id: owner.id,
        name: owner.name,
        username: owner.username,
        email: owner.email,
        role: owner.role,
        hasCredentials: !!owner.encryptedCredentials,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// -------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    res.status(400).json({ error: 'Please enter your username/email and password.' });
    return;
  }

  const user = db.findUserByUsernameOrEmail(identifier);
  if (!user) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  if (user.disabled) {
    res.status(403).json({ error: 'Account disabled. Please contact your administrator.' });
    return;
  }

  const valid = verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!valid) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const sessionToken = createSession(user.id, user.role);

  res.cookie('eman_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      externalUserId: user.externalUserId,
      hasCredentials: !!user.encryptedCredentials,
    },
  });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const sessionToken = req.cookies?.['eman_session'] || req.headers['x-session-token'];
  if (sessionToken && typeof sessionToken === 'string') {
    invalidateSession(sessionToken);
  }
  res.clearCookie('eman_session');
  res.json({ success: true });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    externalUserId: user.externalUserId,
    hasCredentials: !!user.encryptedCredentials,
  });
});

apiRouter.post('/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Please provide current and new password.' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    return;
  }

  const isCurrentValid = verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
  if (!isCurrentValid) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  db.updateUser(user.id, { newPassword });
  res.json({ success: true, message: 'Password updated successfully.' });
});

// -------------------------------------------------------------
// ADMIN: USER MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/admin/users', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const users = db.getAllUsers().map(u => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role,
    disabled: u.disabled,
    createdAt: u.createdAt,
    externalUserId: u.externalUserId || '',
    hasCredentials: !!u.encryptedCredentials,
    credentialHeaderOverride: u.credentialHeaderOverride || '',
  }));
  res.json(users);
});

apiRouter.post('/admin/users', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { name, username, email, role, password, externalUserId } = req.body || {};

  if (!name || !username || !password) {
    res.status(400).json({ error: 'Name, username, and password are required.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }
  if (role !== 'admin' && role !== 'user') {
    res.status(400).json({ error: 'Role must be either "admin" or "user".' });
    return;
  }

  try {
    const newUser = db.createUser({
      name,
      username,
      email: email || `${username.toLowerCase()}@emanbakeries.internal`,
      role,
      password,
      externalUserId,
    });

    res.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        disabled: newUser.disabled,
        externalUserId: newUser.externalUserId,
        hasCredentials: false,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

apiRouter.patch('/admin/users/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, email, role, disabled, externalUserId, newPassword } = req.body || {};

  try {
    const updated = db.updateUser(id, {
      name,
      email,
      role,
      disabled,
      externalUserId,
      newPassword,
    });

    res.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        disabled: updated.disabled,
        externalUserId: updated.externalUserId,
        hasCredentials: !!updated.encryptedCredentials,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

apiRouter.delete('/admin/users/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    db.deleteUser(id, req.user!.id);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

apiRouter.put('/admin/users/:id/credentials', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { secret, headerOverride, clear } = req.body || {};

  try {
    db.setUserCredentials(id, {
      secret,
      headerOverride,
      clear: !!clear,
    });
    res.json({
      success: true,
      hasCredentials: !clear && !!secret,
      message: clear ? 'Credentials removed.' : 'Credentials securely encrypted and saved.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// -------------------------------------------------------------
// ADMIN: CONNECTION SETTINGS
// -------------------------------------------------------------

apiRouter.get('/admin/connection', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const conn = db.getConnectionConfig();
  res.json({
    endpoint: conn.endpoint,
    method: conn.method,
    authMode: conn.authMode,
    authHeaderName: conn.authHeaderName,
    hasGlobalSecret: !!conn.encryptedGlobalSecret,
    contentType: conn.contentType,
    qrFieldName: conn.qrFieldName,
    qrNestingPath: conn.qrNestingPath,
    externalUserIdField: conn.externalUserIdField,
    staticFieldsJson: conn.staticFieldsJson,
    successRule: conn.successRule,
    customHeaders: conn.customHeaders.map(h => ({
      key: h.key,
      value: h.isSecret ? '••••••••' : h.value,
      isSecret: h.isSecret,
    })),
  });
});

apiRouter.put('/admin/connection', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const body = req.body || {};

  const updates: any = {};
  if (body.endpoint !== undefined) updates.endpoint = String(body.endpoint).trim();
  if (body.method !== undefined && ['POST', 'PUT', 'PATCH'].includes(body.method)) {
    updates.method = body.method;
  }
  if (body.authMode !== undefined && ['bearer', 'header', 'none'].includes(body.authMode)) {
    updates.authMode = body.authMode;
  }
  if (body.authHeaderName !== undefined) {
    updates.authHeaderName = String(body.authHeaderName).trim() || 'Authorization';
  }
  if (body.contentType !== undefined) {
    updates.contentType = body.contentType === 'application/x-www-form-urlencoded'
      ? 'application/x-www-form-urlencoded'
      : 'application/json';
  }
  if (body.qrFieldName !== undefined) {
    updates.qrFieldName = String(body.qrFieldName).trim() || 'qr_payload';
  }
  if (body.qrNestingPath !== undefined) {
    updates.qrNestingPath = String(body.qrNestingPath).trim();
  }
  if (body.externalUserIdField !== undefined) {
    updates.externalUserIdField = String(body.externalUserIdField).trim();
  }
  if (body.staticFieldsJson !== undefined) {
    const raw = String(body.staticFieldsJson).trim();
    if (raw) {
      try {
        JSON.parse(raw);
        updates.staticFieldsJson = raw;
      } catch {
        res.status(400).json({ error: 'Static fields must be valid JSON or empty.' });
        return;
      }
    } else {
      updates.staticFieldsJson = '';
    }
  }
  if (body.successRule !== undefined && typeof body.successRule === 'object') {
    updates.successRule = body.successRule;
  }

  // Handle global secret
  if (body.globalSecret !== undefined) {
    if (body.globalSecret === null || body.globalSecret === '') {
      db.setGlobalSecret(null);
    } else {
      db.setGlobalSecret(String(body.globalSecret));
    }
  }

  // Handle custom headers
  if (Array.isArray(body.customHeaders)) {
    const validHeaders: Array<{ key: string; value: string; isSecret: boolean }> = [];
    for (const h of body.customHeaders) {
      const sanitizedKey = sanitizeHeaderName(h.key);
      if (sanitizedKey) {
        validHeaders.push({
          key: sanitizedKey,
          value: String(h.value || ''),
          isSecret: !!h.isSecret,
        });
      }
    }
    db.setCustomHeaders(validHeaders);
  }

  db.updateConnectionConfig(updates);
  res.json({ success: true, message: 'Connection settings successfully saved.' });
});

// Admin connectivity test (distinguished from business operation)
apiRouter.post('/admin/connection/test', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { endpoint, testMethod } = req.body || {};
  const targetUrl = endpoint || db.getConnectionConfig().endpoint;

  if (!targetUrl) {
    res.status(400).json({ error: 'Please specify an endpoint URL to test.' });
    return;
  }

  const ssrfCheck = await validateOutboundUrl(targetUrl);
  if (!ssrfCheck.valid) {
    res.status(400).json({
      success: false,
      error: `Security Validation Failed: ${ssrfCheck.error}`,
      isSsrfBlock: true,
    });
    return;
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    // Send a harmless OPTIONS or HEAD or non-destructive GET probe
    const method = testMethod || 'HEAD';
    const response = await fetch(targetUrl, {
      method,
      signal: controller.signal,
      headers: {
        'User-Agent': 'EmanQR-ConnectionProbe/1.0',
        'X-Probe-Type': 'Connectivity-Check',
      },
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      statusCode: response.status,
      statusText: response.statusText,
      latencyMs,
      message: `Connectivity established (HTTP ${response.status} in ${latencyMs}ms). This confirms the network route and TLS handshake. (Note: Business payload delivery rules are verified separately during QR send).`,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = err instanceof Error ? err.message : String(err);

    res.status(200).json({
      success: false,
      isTimeout,
      latencyMs,
      error: isTimeout ? 'Connection timed out after 8 seconds.' : `Network error: ${message}`,
      message: 'Could not reach target endpoint.',
    });
  }
});

// Admin audit logs
apiRouter.get('/admin/audit-logs', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json(db.getRecentAuditLogs(50));
});

// -------------------------------------------------------------
// SCANNER OPERATIONS
// -------------------------------------------------------------

apiRouter.get('/scanner/config-status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const conn = db.getConnectionConfig();

  const isEndpointConfigured = !!conn.endpoint && conn.endpoint.startsWith('http');
  const userSecret = db.getUserSecret(user.id);
  const globalSecret = db.getGlobalSecret();

  const isAuthSatisfied =
    conn.authMode === 'none' ||
    (conn.authMode === 'bearer' && (!!userSecret || !!globalSecret)) ||
    (conn.authMode === 'header' && (!!userSecret || !!globalSecret));

  res.json({
    isEndpointConfigured,
    hasUserCredentials: !!userSecret,
    hasGlobalCredentials: !!globalSecret,
    isAuthSatisfied,
    authMode: conn.authMode,
    endpointHost: conn.endpoint ? new URL(conn.endpoint).hostname : null,
    employeeName: user.name,
    externalUserId: user.externalUserId || 'Not assigned',
  });
});

apiRouter.post('/scanner/send', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { qrPayload, idempotencyKey } = req.body || {};

  // Strict Payload Validation: preserve exact text string
  if (typeof qrPayload !== 'string' || qrPayload.length === 0) {
    res.status(400).json({ error: 'QR payload is missing or empty.' });
    return;
  }

  const conn = db.getConnectionConfig();
  if (!conn.endpoint) {
    res.status(400).json({
      error: 'Connection not configured. An administrator must set the target endpoint in Admin Settings before invoices can be submitted.',
    });
    return;
  }

  // Anti-concurrency lock: prevent double-clicks
  const submissionKey = `${user.id}:${idempotencyKey || qrPayload.substring(0, 32)}`;
  if (inFlightSubmissions.has(submissionKey)) {
    res.status(429).json({
      error: 'A submission for this invoice is already in progress. Please wait for the response.',
    });
    return;
  }
  inFlightSubmissions.add(submissionKey);

  // SSRF check on target endpoint
  const ssrfCheck = await validateOutboundUrl(conn.endpoint);
  if (!ssrfCheck.valid) {
    inFlightSubmissions.delete(submissionKey);
    res.status(400).json({
      error: `Security policy blocked outbound request: ${ssrfCheck.error}`,
    });
    return;
  }

  // Resolve employee credentials strictly for the authenticated user
  const userSecret = db.getUserSecret(user.id);
  const globalSecret = db.getGlobalSecret();
  const effectiveSecret = userSecret || globalSecret;

  if (conn.authMode !== 'none' && !effectiveSecret) {
    inFlightSubmissions.delete(submissionKey);
    res.status(400).json({
      error: 'Your user account does not have external API credentials configured. Please ask your administrator to assign your API key or token in User Settings.',
    });
    return;
  }

  // Build the outgoing payload without altering the raw qrPayload string
  let requestBody: any;
  const headers: Record<string, string> = {
    ...db.resolveCustomHeaders(),
  };

  // Add authentication header
  if (conn.authMode === 'bearer' && effectiveSecret) {
    headers['Authorization'] = `Bearer ${effectiveSecret}`;
  } else if (conn.authMode === 'header' && effectiveSecret) {
    const headerName = user.credentialHeaderOverride || conn.authHeaderName || 'X-API-Key';
    const cleanHeaderName = sanitizeHeaderName(headerName) || 'X-API-Key';
    headers[cleanHeaderName] = effectiveSecret;
  }

  // Add idempotency header if supported
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  // Construct structured data
  if (conn.contentType === 'application/x-www-form-urlencoded') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const params = new URLSearchParams();
    if (conn.staticFieldsJson) {
      try {
        const parsed = JSON.parse(conn.staticFieldsJson);
        for (const [k, v] of Object.entries(parsed)) {
          params.append(k, String(v));
        }
      } catch {
        // ignore
      }
    }
    if (conn.externalUserIdField && user.externalUserId) {
      params.append(conn.externalUserIdField, user.externalUserId);
    }
    // EXACT UNTOUCHED PAYLOAD
    params.append(conn.qrFieldName || 'qr_payload', qrPayload);
    requestBody = params.toString();
  } else {
    // JSON content type
    headers['Content-Type'] = 'application/json';
    const payloadObj: Record<string, any> = {};

    // Incorporate static fields
    if (conn.staticFieldsJson) {
      try {
        const parsed = JSON.parse(conn.staticFieldsJson);
        Object.assign(payloadObj, parsed);
      } catch {
        // ignore
      }
    }

    // Add external user ID if configured
    if (conn.externalUserIdField && user.externalUserId) {
      payloadObj[conn.externalUserIdField] = user.externalUserId;
    }

    // Embed exact untouched string at configured field or nesting
    if (conn.qrNestingPath) {
      setNestedProperty(payloadObj, `${conn.qrNestingPath}.${conn.qrFieldName || 'qr_payload'}`, qrPayload);
    } else {
      payloadObj[conn.qrFieldName || 'qr_payload'] = qrPayload;
    }

    requestBody = JSON.stringify(payloadObj);
  }

  const controller = new AbortController();
  const timeoutMs = 15000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(conn.endpoint, {
      method: conn.method || 'POST',
      headers,
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timer);
    inFlightSubmissions.delete(submissionKey);

    const responseStatus = response.status;
    let responseText = '';
    let responseJson: any = null;

    try {
      responseText = await response.text();
      responseJson = JSON.parse(responseText);
    } catch {
      // not JSON or empty
    }

    // Evaluate success criteria
    const rule = conn.successRule || { type: 'status_code', minStatus: 200, maxStatus: 299 };
    let isBusinessSuccess = false;

    if (rule.type === 'status_code') {
      const min = rule.minStatus ?? 200;
      const max = rule.maxStatus ?? 299;
      isBusinessSuccess = responseStatus >= min && responseStatus <= max;
    } else if (rule.type === 'json_match' && rule.jsonPath && responseJson) {
      const actualVal = String(getNestedProperty(responseJson, rule.jsonPath));
      isBusinessSuccess = actualVal === String(rule.expectedValue);
    } else {
      isBusinessSuccess = responseStatus >= 200 && responseStatus <= 299;
    }

    // Audit log (Redacting payload and sensitive credentials!)
    db.addAuditLog({
      userId: user.id,
      username: user.username,
      status: isBusinessSuccess ? 'success' : 'failure',
      statusCode: responseStatus,
      responseSummary: `HTTP ${responseStatus}: ${isBusinessSuccess ? 'Criteria matched' : 'Failed business criteria'}`,
    });

    if (isBusinessSuccess) {
      res.json({
        success: true,
        statusCode: responseStatus,
        message: 'Invoice payload successfully delivered and accepted by destination API.',
        timestamp: new Date().toISOString(),
      });
    } else {
      // Truncate response text for preview without leaking internal secrets
      const safeExcerpt = responseText.length > 200 ? responseText.substring(0, 200) + '...' : responseText;
      res.status(422).json({
        success: false,
        statusCode: responseStatus,
        error: `Destination API returned status ${responseStatus}. Success criteria not met.`,
        responseExcerpt: safeExcerpt,
      });
    }
  } catch (err: unknown) {
    clearTimeout(timer);
    inFlightSubmissions.delete(submissionKey);

    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = err instanceof Error ? err.message : String(err);

    db.addAuditLog({
      userId: user.id,
      username: user.username,
      status: isTimeout ? 'timeout' : 'failure',
      responseSummary: isTimeout ? 'Request timed out after 15s' : `Network error: ${message}`,
    });

    if (isTimeout) {
      res.status(504).json({
        success: false,
        timeout: true,
        error: 'Destination API request timed out after 15 seconds. The write may or may not have succeeded on the remote server. Please do not re-send without checking your destination records.',
      });
    } else {
      res.status(502).json({
        success: false,
        error: `Failed to reach external destination: ${message}`,
      });
    }
  }
});
