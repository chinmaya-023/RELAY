import { z } from 'zod';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'Identifier contains unsupported characters.');
const publicOrigin = z.string().url().max(2048);
const healthPath = z.string().startsWith('/').max(512).refine((value) => !value.includes('://') && !value.includes('\\'), 'Health path must be a relative URL path.');
const hasControlCharacters = (value) => [...value].some((character) => {
  const codePoint = character.codePointAt(0);
  return codePoint < 32 || codePoint === 127;
});
const safeText = (minimum, maximum) => z.string().trim().min(minimum).max(maximum).refine((value) => !hasControlCharacters(value), 'Text contains unsupported control characters.');
const emailAddress = z.string().trim().email().max(254);

export const projectIdSchema = z.object({ id });
export const backendIdSchema = z.object({ id });
export const createProjectSchema = z.object({ name: safeText(2, 80), description: safeText(0, 280).optional() });
export const updateProjectSchema = createProjectSchema.partial().refine((value) => Object.keys(value).length > 0);
export const createBackendSchema = z.object({ name: safeText(2, 80), originUrl: publicOrigin, healthPath: healthPath.optional(), role: z.enum(['PRIMARY', 'SECONDARY']).optional() });
export const updateBackendSchema = createBackendSchema.partial().refine((value) => Object.keys(value).length > 0);
export const monitorSchema = z.object({ enabled: z.boolean().optional(), intervalSeconds: z.number().int().min(60).max(86_400).optional(), timeoutSeconds: z.number().int().min(1).max(60).optional(), maxAttempts: z.number().int().min(1).max(5).optional(), retryDelaySeconds: z.number().int().min(60).max(3_600).optional(), failureThreshold: z.number().int().min(1).max(20).optional(), recoveryThreshold: z.number().int().min(1).max(20).optional(), keepAliveEnabled: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);
const gatewaySlug = z.string().trim().min(3).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use 3–48 lowercase letters, numbers, or hyphens. Start and end with a letter or number.');
export const gatewaySchema = z.object({ enabled: z.boolean().optional(), slug: gatewaySlug.optional(), rateLimit: z.object({ windowSeconds: z.number().int().min(1).max(3600), maxRequests: z.number().int().min(1).max(100_000) }).optional() }).refine((value) => Object.keys(value).length > 0);
export const failoverSchema = z.object({ enabled: z.boolean().optional(), primaryBackendId: id.nullable().optional(), secondaryBackendId: id.nullable().optional(), failureThreshold: z.number().int().min(1).max(20).optional(), recoveryThreshold: z.number().int().min(1).max(20).optional(), cooldownSeconds: z.number().int().min(0).max(86_400).optional(), recoveryMode: z.enum(['automatic', 'manual']).optional() }).refine((value) => Object.keys(value).length > 0);
export const apiKeyIdSchema = z.object({ id });
export const apiKeySchema = z.object({ name: safeText(2, 80), projectId: id.nullable().optional(), scopes: z.array(z.enum(['project:read', 'project:write', 'monitoring:read', 'monitoring:write', 'gateway:read', 'gateway:write'])).min(1).max(6), expiresAt: z.number().int().positive().nullable().optional() });
export const accountDeletionRequestSchema = z.object({ email: emailAddress });
