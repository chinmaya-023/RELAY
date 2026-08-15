import { randomUUID } from 'node:crypto';
import { db } from '../firebase/admin.js';
import { AppError, notFound } from '../lib/errors.js';

const now = () => Date.now();
const identifier = (prefix) => `${prefix}_${randomUUID()}`;
const projectIndexPath = (uid, projectId) => `indexes/users/${uid}/projects/${projectId}`;
const projectBackendIndexPath = (projectId, backendId) => `indexes/projects/${projectId}/backends/${backendId}`;

export class FirebaseRepository {
  async get(path) {
    const snapshot = await db().ref(path).get();
    return snapshot.exists() ? snapshot.val() : null;
  }

  async update(values) { await db().ref().update(values); }

  async projectForUser(projectId, uid) {
    const membership = await this.get(`members/${projectId}/${uid}`);
    if (!membership) throw new AppError(403, 'PROJECT_ACCESS_DENIED', 'You do not have access to this project.');
    const project = await this.get(`projects/${projectId}`);
    if (!project) throw notFound('Project not found.');
    return { ...project, role: membership.role };
  }

  async listProjects(uid) {
    const index = (await this.get(`indexes/users/${uid}/projects`)) ?? {};
    return Object.entries(index).map(([id, item]) => ({ id, ...item })).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async createProject(uid, input) {
    const id = identifier('prj');
    const timestamp = now();
    const project = { id, name: input.name, description: input.description ?? '', ownerId: uid, createdAt: timestamp, updatedAt: timestamp, version: 1 };
    await this.update({
      [`projects/${id}`]: project,
      [`members/${id}/${uid}`]: { role: 'OWNER', createdAt: timestamp },
      [projectIndexPath(uid, id)]: { name: project.name, description: project.description, version: 1, updatedAt: timestamp },
      [`gatewayConfigs/${id}`]: { projectId: id, enabled: false, slug: null, rateLimit: { windowSeconds: 60, maxRequests: 120 }, version: 1, updatedAt: timestamp },
      [`failoverConfigs/${id}`]: { projectId: id, enabled: false, primaryBackendId: null, secondaryBackendId: null, failureThreshold: 3, recoveryThreshold: 2, cooldownSeconds: 60, recoveryMode: 'automatic', version: 1, updatedAt: timestamp },
      [`failoverState/${id}`]: { projectId: id, activeBackendId: null, mode: 'PRIMARY', changedAt: timestamp, version: 1 }
    });
    return project;
  }

  async updateProject(projectId, uid, input) {
    const project = await this.projectForUser(projectId, uid);
    const timestamp = now();
    const next = { ...project, ...input, updatedAt: timestamp, version: project.version + 1 };
    delete next.role;
    await this.update({
      [`projects/${projectId}`]: next,
      [projectIndexPath(project.ownerId, projectId)]: { name: next.name, description: next.description, version: next.version, updatedAt: timestamp }
    });
    return next;
  }

  async deleteProject(projectId, uid) {
    const project = await this.projectForUser(projectId, uid);
    if (project.role !== 'OWNER') throw new AppError(403, 'PROJECT_OWNER_REQUIRED', 'Only the project owner may delete a project.');
    const [backendIndex, gatewayConfig] = await Promise.all([
      this.get(`indexes/projects/${projectId}/backends`),
      this.getGatewayConfig(projectId)
    ]);
    const updates = {
      [`projects/${projectId}`]: null,
      [`members/${projectId}`]: null,
      [`gatewayConfigs/${projectId}`]: null,
      [`failoverConfigs/${projectId}`]: null,
      [`failoverState/${projectId}`]: null,
      [`notifications/${projectId}`]: null,
      [`events/${projectId}`]: null,
      [`indexes/projects/${projectId}`]: null,
      [projectIndexPath(project.ownerId, projectId)]: null
    };
    for (const backendId of Object.keys(backendIndex ?? {})) {
      updates[`backends/${backendId}`] = null;
      updates[`monitors/${backendId}`] = null;
      updates[`health/${backendId}`] = null;
      updates[`healthHistory/${backendId}`] = null;
    }
    if (gatewayConfig?.slug) updates[`gatewaySlugs/${gatewayConfig.slug}`] = null;
    await this.update(updates);
  }

  async listBackends(projectId) {
    const index = (await this.get(`indexes/projects/${projectId}/backends`)) ?? {};
    return Object.entries(index).map(([id, item]) => ({ id, ...item })).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getBackend(backendId) { return this.get(`backends/${backendId}`); }

  async addBackend(projectId, input) {
    const id = identifier('bkd');
    const timestamp = now();
    const backend = { id, projectId, name: input.name, originUrl: input.originUrl, healthPath: input.healthPath ?? '/health', role: input.role ?? 'PRIMARY', originAuthHeader: input.originAuthHeader ?? null, createdAt: timestamp, updatedAt: timestamp, version: 1 };
    const monitor = { backendId: id, enabled: false, intervalSeconds: 600, timeoutSeconds: 10, maxAttempts: 5, retryDelaySeconds: 120, failureThreshold: 1, recoveryThreshold: 2, keepAliveEnabled: false, version: 1, updatedAt: timestamp };
    await this.update({
      [`backends/${id}`]: backend,
      [`monitors/${id}`]: monitor,
      [`health/${id}`]: { backendId: id, status: 'UNKNOWN', consecutiveFailures: 0, consecutiveSuccesses: 0, updatedAt: timestamp, version: 1 },
      [projectBackendIndexPath(projectId, id)]: { name: backend.name, role: backend.role, version: 1, updatedAt: timestamp }
    });
    return backend;
  }

  async updateBackend(backendId, input) {
    const backend = await this.getBackend(backendId);
    if (!backend) throw notFound('Backend not found.');
    const timestamp = now();
    const next = { ...backend, ...input, updatedAt: timestamp, version: backend.version + 1 };
    await this.update({
      [`backends/${backendId}`]: next,
      [projectBackendIndexPath(backend.projectId, backendId)]: { name: next.name, role: next.role, version: next.version, updatedAt: timestamp }
    });
    return next;
  }

  async deleteBackend(backendId) {
    const backend = await this.getBackend(backendId);
    if (!backend) throw notFound('Backend not found.');
    await this.update({
      [`backends/${backendId}`]: null,
      [`monitors/${backendId}`]: null,
      [`health/${backendId}`]: null,
      [`healthHistory/${backendId}`]: null,
      [projectBackendIndexPath(backend.projectId, backendId)]: null
    });
  }

  async getMonitor(backendId) { return this.get(`monitors/${backendId}`); }

  async updateMonitor(backendId, input) {
    const monitor = await this.getMonitor(backendId);
    if (!monitor) throw notFound('Monitor not found.');
    const next = { ...monitor, ...input, version: monitor.version + 1, updatedAt: now() };
    await this.update({ [`monitors/${backendId}`]: next });
    return next;
  }

  async getHealth(backendId) { return this.get(`health/${backendId}`); }

  async saveHealth(backendId, health, historyItem) {
    const historyId = identifier('hlth');
    await this.update({ [`health/${backendId}`]: health, [`healthHistory/${backendId}/${historyId}`]: historyItem });
  }

  async listEnabledMonitors() {
    const monitors = (await this.get('monitors')) ?? {};
    return Object.values(monitors).filter((monitor) => monitor.enabled);
  }

  async getGatewayConfig(projectId) { return this.get(`gatewayConfigs/${projectId}`); }

  async projectIdForGatewaySlug(slug) { return this.get(`gatewaySlugs/${slug}`); }

  async updateGatewayConfig(projectId, input) {
    const existing = await this.getGatewayConfig(projectId);
    if (!existing) throw notFound('Gateway configuration not found.');
    const changingSlug = input.slug && input.slug !== existing.slug;
    if (changingSlug) {
      const claim = await db().ref(`gatewaySlugs/${input.slug}`).transaction((current) => {
        if (!current || current === projectId) return projectId;
        return undefined;
      });
      if (!claim.committed || claim.snapshot.val() !== projectId) {
        throw new AppError(409, 'GATEWAY_NAME_TAKEN', 'This gateway name is already in use. Choose another name.');
      }
    }
    const next = { ...existing, ...input, version: existing.version + 1, updatedAt: now() };
    const updates = { [`gatewayConfigs/${projectId}`]: next };
    if (changingSlug && existing.slug) updates[`gatewaySlugs/${existing.slug}`] = null;
    try {
      await this.update(updates);
    } catch (error) {
      if (changingSlug) await db().ref(`gatewaySlugs/${input.slug}`).transaction((current) => (current === projectId ? null : current)).catch(() => undefined);
      throw error;
    }
    return next;
  }

  async getFailoverConfig(projectId) { return this.get(`failoverConfigs/${projectId}`); }
  async getFailoverState(projectId) { return this.get(`failoverState/${projectId}`); }

  async updateFailoverConfig(projectId, input) {
    const existing = await this.getFailoverConfig(projectId);
    if (!existing) throw notFound('Failover configuration not found.');
    const next = { ...existing, ...input, version: existing.version + 1, updatedAt: now() };
    await this.update({ [`failoverConfigs/${projectId}`]: next });
    return next;
  }

  async saveFailoverState(projectId, state) { await this.update({ [`failoverState/${projectId}`]: state }); }

  async appendEvent(projectId, event) {
    const id = identifier('evt');
    const entry = { id, projectId, timestamp: now(), ...event };
    await this.update({ [`events/${projectId}/${id}`]: entry });
    return entry;
  }

  async listEvents(projectId, limit = 50) {
    const events = (await this.get(`events/${projectId}`)) ?? {};
    return Object.values(events).sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  async listAllProjects() {
    const projects = (await this.get('projects')) ?? {};
    return Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async createNotification(projectId, notification) {
    const id = identifier('ntf');
    const entry = { id, projectId, timestamp: now(), ...notification };
    await this.update({ [`notifications/${projectId}/${id}`]: entry });
    return entry;
  }

  async updateNotification(projectId, notificationId, input) {
    const existing = await this.get(`notifications/${projectId}/${notificationId}`);
    if (!existing) throw notFound('Notification record not found.');
    const next = { ...existing, ...input, updatedAt: now() };
    await this.update({ [`notifications/${projectId}/${notificationId}`]: next });
    return next;
  }

  async createApiKey(uid, apiKey) {
    await this.update({
      [`apiKeys/${apiKey.id}`]: apiKey,
      [`apiKeyPrefixes/${apiKey.prefix}`]: apiKey.id,
      [`indexes/users/${uid}/apiKeys/${apiKey.id}`]: { id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix, scopes: apiKey.scopes, projectId: apiKey.projectId ?? null, createdAt: apiKey.createdAt, expiresAt: apiKey.expiresAt ?? null, revokedAt: null }
    });
  }

  async getApiKeyByPrefix(prefix) {
    const id = await this.get(`apiKeyPrefixes/${prefix}`);
    return id ? this.get(`apiKeys/${id}`) : null;
  }

  async listApiKeys(uid) {
    const index = (await this.get(`indexes/users/${uid}/apiKeys`)) ?? {};
    return Object.values(index).sort((a, b) => b.createdAt - a.createdAt);
  }

  async revokeApiKey(id, uid) {
    const key = await this.get(`apiKeys/${id}`);
    if (!key || key.userId !== uid) throw notFound('API key not found.');
    const timestamp = now();
    await this.update({
      [`apiKeys/${id}/revokedAt`]: timestamp,
      [`indexes/users/${uid}/apiKeys/${id}/revokedAt`]: timestamp
    });
    return { ...key, revokedAt: timestamp };
  }

  async getAccountDeletionRequest(uid) { return this.get(`accountDeletionRequests/${uid}`); }

  async saveAccountDeletionRequest(uid, request) {
    await this.update({ [`accountDeletionRequests/${uid}`]: request });
    return request;
  }

  async createAccountDeletionRequest(uid, request) {
    const result = await db().ref(`accountDeletionRequests/${uid}`).transaction((existing) => (
      ['PENDING', 'PROCESSING'].includes(existing?.status) || existing?.cooldownUntil > request.requestedAt ? undefined : request
    ));
    return { created: result.committed, request: result.snapshot.val() };
  }

  async listAccountDeletionRequests() {
    const requests = (await this.get('accountDeletionRequests')) ?? {};
    return Object.entries(requests).map(([uid, request]) => ({ uid, ...request })).sort((a, b) => b.requestedAt - a.requestedAt);
  }

  async clearAccountDeletionRequest(uid) { await this.update({ [`accountDeletionRequests/${uid}`]: null }); }

  async claimAccountDeletionRequest(uid, reviewerUid, timestamp) {
    const result = await db().ref(`accountDeletionRequests/${uid}`).transaction((request) => {
      if (request?.status !== 'PENDING') return undefined;
      return { ...request, status: 'PROCESSING', reviewedBy: reviewerUid, reviewedAt: timestamp };
    });
    return { claimed: result.committed, request: result.snapshot.val() };
  }

  async rejectAccountDeletionRequest(uid, reviewerUid, timestamp) {
    const result = await db().ref(`accountDeletionRequests/${uid}`).transaction((request) => {
      if (request?.status !== 'PENDING') return undefined;
      return { ...request, status: 'REJECTED', reviewedBy: reviewerUid, reviewedAt: timestamp };
    });
    return { reviewed: result.committed, request: result.snapshot.val() };
  }

  async releaseAccountDeletionRequest(uid) {
    await db().ref(`accountDeletionRequests/${uid}`).transaction((request) => (
      request?.status === 'PROCESSING' ? { ...request, status: 'PENDING', reviewedBy: null, reviewedAt: null, lastFailureAt: now() } : request
    ));
  }

  async deleteAccountData(uid) {
    const [projects, apiKeys] = await Promise.all([this.listProjects(uid), this.listApiKeys(uid)]);
    await Promise.all(projects.map(async (project) => {
      const membership = await this.get(`members/${project.id}/${uid}`);
      if (membership?.role === 'OWNER') return this.deleteProject(project.id, uid);
      return this.update({ [`members/${project.id}/${uid}`]: null, [projectIndexPath(uid, project.id)]: null });
    }));

    const updates = {
      [`indexes/users/${uid}`]: null
    };
    for (const key of apiKeys) {
      updates[`apiKeys/${key.id}`] = null;
      updates[`apiKeyPrefixes/${key.prefix}`] = null;
    }
    await this.update(updates);
    return projects;
  }
}
