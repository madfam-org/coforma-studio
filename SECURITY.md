# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in Coforma Studio, please report it to us privately:

### Contact

- **Email**: security@innovacionesmadfam.dev
- **Response Time**: We aim to acknowledge reports within 48 hours
- **Resolution Time**: Critical vulnerabilities will be addressed within 7 days

### What to Include

When reporting a vulnerability, please include:

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Potential impact** (e.g., data exposure, privilege escalation)
4. **Suggested fix** (if you have one)
5. **Your contact information** for follow-up

### Our Process

1. **Acknowledgment**: We'll confirm receipt of your report within 48 hours
2. **Investigation**: We'll investigate and validate the vulnerability
3. **Fix Development**: We'll develop and test a fix
4. **Disclosure**: We'll coordinate disclosure with you
5. **Credit**: We'll publicly credit you (if you wish) in our security advisories

## Security Best Practices

### For Developers

#### 1. **Multi-Tenant Data Isolation (Critical)**

**Always enforce Row-Level Security (RLS):**

```typescript
// ✅ CORRECT: Set tenant context before queries
await prisma.$executeRaw`SET app.tenant_id = ${tenantId}`;
const users = await prisma.user.findMany();

// ❌ WRONG: Query without tenant context
const users = await prisma.user.findMany(); // Potential data leak!
```

**Test RLS policies:**
- Write integration tests that attempt to access other tenants' data
- Run chaos drills quarterly to verify isolation

#### 2. **Secrets Management**

- **Never commit** `.env.local` or any files containing secrets
- **Use environment variables** for all sensitive configuration
- **Rotate secrets** quarterly:
  - Database passwords
  - API keys (Stripe, Resend, OAuth clients)
  - NextAuth secret
  - Encryption keys

#### 3. **Authentication & Authorization**

- **Always use NextAuth.js** for authentication (never roll your own)
- **Verify session** on every API request
- **Check permissions** using CASL before mutations
- **Use database sessions** (not JWT) for multi-device logout support

```typescript
// ✅ CORRECT: Check permissions
import { ability } from '@/lib/casl';

if (ability.can('update', feedbackItem)) {
  await updateFeedbackItem(feedbackItem);
}

// ❌ WRONG: No permission check
await updateFeedbackItem(feedbackItem);
```

#### 4. **Input Validation**

- **Always validate inputs** using Zod schemas
- **Sanitize user-generated content** before rendering
- **Validate file uploads**: check MIME type, size, and content

```typescript
// ✅ CORRECT: Validate with Zod
const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

const user = userSchema.parse(input);

// ❌ WRONG: No validation
const user = input;
```

#### 5. **SQL Injection Prevention**

- **Use Prisma** for all database queries (automatically parameterized)
- **Never use string concatenation** for SQL queries
- **Use `$executeRaw` with parameters** if raw SQL is needed

```typescript
// ✅ CORRECT: Parameterized query
await prisma.$executeRaw`SELECT * FROM users WHERE id = ${userId}`;

// ❌ WRONG: String concatenation
await prisma.$executeRawUnsafe(`SELECT * FROM users WHERE id = ${userId}`);
```

#### 6. **XSS Prevention**

- **Use React** (automatic escaping)
- **Never use `dangerouslySetInnerHTML`** without sanitization
- **Set Content Security Policy (CSP)** headers

#### 7. **CSRF Protection**

- **NextAuth.js** provides automatic CSRF protection
- **Use SameSite=Lax** for cookies (default)
- **Verify CSRF tokens** for state-changing operations

#### 8. **Rate Limiting**

- **Implement rate limiting** on all public endpoints
- **Use Redis** for shared rate limit state
- **Apply stricter limits** to auth endpoints

```typescript
// Example: Rate limit signup endpoint
import rateLimit from 'express-rate-limit';

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/auth/signup', signupLimiter, signupHandler);
```

#### 9. **File Upload Security**

- **Validate MIME types** (don't trust client-side extensions)
- **Scan for malware** (future: integrate ClamAV)
- **Store in private buckets** (Cloudflare R2)
- **Use signed URLs** for access (time-limited)
- **Limit file sizes** (e.g., 10MB for uploads)

```typescript
// ✅ CORRECT: Validate and use signed URL
import { validateFileType, generateSignedUrl } from '@/lib/storage';

if (!validateFileType(file, ['application/pdf', 'image/jpeg'])) {
  throw new Error('Invalid file type');
}

const url = await generateSignedUrl(file, { expiresIn: 3600 });
```

#### 10. **Logging & Monitoring**

- **Log security events** (failed logins, permission denials)
- **Never log secrets** (redact tokens, passwords)
- **Use structured logging** (JSON format)
- **Monitor for anomalies** (Sentry, Better Stack)

```typescript
// ✅ CORRECT: Redact sensitive data
logger.info('User login', {
  userId: user.id,
  email: user.email.replace(/(?<=.{2}).(?=.*@)/g, '*'), // Redact email
});

// ❌ WRONG: Log raw tokens
logger.info('OAuth token', { token: oauthToken });
```

### For Operations

#### 1. **Infrastructure Security**

- **Enable TLS 1.3** for all services (Vercel, Railway, Cloudflare)
- **Use HSTS** headers (enforce HTTPS)
- **Enable WAF** (Cloudflare Web Application Firewall)
- **Apply security headers**:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`

#### 2. **Database Security**

- **Enable RLS** on all tables (PostgreSQL Row-Level Security)
- **Use least-privilege database users**
- **Encrypt at rest** (Railway default)
- **Encrypt in transit** (SSL/TLS connections)
- **Daily backups** (automated via Railway)
- **Quarterly restore tests**

#### 3. **Secrets Rotation**

**Quarterly Rotation Schedule:**

| Secret                  | Provider       | Last Rotated | Next Rotation |
|-------------------------|----------------|--------------|---------------|
| Database Password       | Railway        | -            | Q1 2026       |
| Redis Password          | Railway        | -            | Q1 2026       |
| Stripe API Key          | Stripe         | -            | Q1 2026       |
| NextAuth Secret         | Manual         | -            | Q1 2026       |
| OAuth Client Secrets    | Google/MS      | -            | Q1 2026       |
| Cloudflare R2 Keys      | Cloudflare     | -            | Q1 2026       |

**Rotation Process:**
1. Generate new secret via provider dashboard
2. Update environment variables in Railway/Vercel (not yet applied)
3. Deploy new version (zero-downtime)
4. Verify health checks pass
5. Revoke old secret after 24-hour grace period

#### 4. **Dependency Updates**

- **Enable Dependabot** (GitHub)
- **Review security advisories** weekly
- **Apply critical patches** within 48 hours
- **Update dependencies** monthly (non-critical)

#### 5. **Incident Response**

**Security Incident Playbook:**

1. **Detection** (via Sentry, Better Stack, or manual report)
2. **Containment**:
   - Isolate affected systems
   - Rotate compromised credentials
   - Block malicious IPs (Cloudflare)
3. **Eradication**:
   - Identify root cause
   - Deploy fix
4. **Recovery**:
   - Restore from backups if necessary
   - Verify system integrity
5. **Lessons Learned**:
   - Post-mortem document
   - Update runbooks

## Compliance

### GDPR (EU)

- **Data Subject Rights**: Right to access, rectify, delete, portability
- **Consent Management**: Clear opt-in for data processing
- **Data Breach Notification**: Within 72 hours of discovery
- **Data Protection Officer**: security@innovacionesmadfam.dev

### LGPD (Brazil)

- Similar requirements to GDPR
- **Data Controller**: Innovaciones MADFAM S.A.S. de C.V.

### Data Retention

| Data Type                | Retention Period | Reason                  |
|--------------------------|------------------|-------------------------|
| User accounts            | Active + 2 years | GDPR compliance         |
| Audit logs               | 7 years          | Legal requirement       |
| Session data             | 30 days          | Security monitoring     |
| Deleted user data        | 30 days          | Recovery window         |
| Backups                  | 90 days          | Disaster recovery       |

### Data Subject Requests (DSR)

Users can request:
- **Data export** (via UI: Settings → Export Data)
- **Data deletion** (via UI: Settings → Delete Account)
- **Data correction** (via UI: Settings → Edit Profile)

**Admin DSR Handling:**
- Manual requests: security@innovacionesmadfam.dev
- Response time: 30 days (per GDPR)

## Security Tools

| Tool              | Purpose                          | Status |
|-------------------|----------------------------------|--------|
| **Dependabot**    | Dependency vulnerability scanning | ✅     |
| **Snyk**          | Additional security scanning      | 🔄     |
| **Sentry**        | Error tracking & monitoring       | ✅     |
| **Better Stack**  | Log aggregation & analysis        | ✅     |
| **Cloudflare WAF** | Web application firewall         | ✅     |
| **Trivy**         | Container vulnerability scanning  | ✅     |

## Security Checklist (Pre-Deployment)

- [ ] All secrets in environment variables (not code)
- [ ] RLS policies enabled on all tables
- [ ] Input validation using Zod
- [ ] CSRF protection enabled (NextAuth)
- [ ] Rate limiting on public endpoints
- [ ] Security headers configured (Helmet)
- [ ] TLS 1.3 enabled
- [ ] Database backups verified
- [ ] Sentry error tracking configured
- [ ] Audit logging enabled
- [ ] Dependabot enabled
- [ ] Security incident playbook reviewed

## Known Security Considerations

### Multi-Tenancy (Critical)

**Risk**: Tenant data leakage via RLS bypass

**Mitigation**:
- Comprehensive integration tests for RLS
- Chaos drills (quarterly)
- Code review focus on Prisma queries

### OAuth Token Storage

**Risk**: Access tokens stored in database (encrypted)

**Mitigation**:
- Encrypt tokens with AES-256
- Rotate encryption keys quarterly
- Use short-lived tokens where possible

### File Upload Attack Vectors

**Risk**: Malicious file uploads

**Mitigation**:
- MIME type validation (server-side)
- File size limits (10MB)
- Private R2 buckets (no direct access)
- Signed URLs with expiration

## Contact

- **Security Team**: security@innovacionesmadfam.dev
- **General Inquiries**: hello@innovacionesmadfam.dev
- **Bug Bounty**: Not yet available (planned for Phase 2)

---

**Last Updated**: 2025-11-14
**Next Review**: 2026-02-14 (Quarterly)
