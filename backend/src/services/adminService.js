import { getAuth } from 'firebase-admin/auth';
import { AppError } from '../lib/errors.js';
import { initializeFirebase } from '../firebase/admin.js';

const publicUser = (user) => ({
  uid: user.uid,
  email: user.email ?? null,
  displayName: user.displayName ?? null,
  emailVerified: user.emailVerified,
  disabled: user.disabled,
  createdAt: user.metadata.creationTime ?? null,
  lastSignInAt: user.metadata.lastSignInTime ?? null
});

export class AdminService {
  constructor(repository, options = {}) {
    this.repository = repository;
    this.accountDeletionService = options.accountDeletionService;
    this.auth = options.auth ?? (() => {
      initializeFirebase();
      return getAuth();
    });
  }

  async overview() {
    const projects = await this.repository.listAllProjects();
    const summaries = await Promise.all(projects.map(async (project) => {
      const [backends, failoverState, events] = await Promise.all([
        this.repository.listBackends(project.id),
        this.repository.getFailoverState(project.id),
        this.repository.listEvents(project.id, 5)
      ]);
      const health = await Promise.all(backends.map((backend) => this.repository.getHealth(backend.id)));
      const statuses = health.reduce((total, item) => ({ ...total, [item?.status ?? 'UNKNOWN']: (total[item?.status ?? 'UNKNOWN'] ?? 0) + 1 }), {});
      return { id: project.id, name: project.name, description: project.description, ownerId: project.ownerId, updatedAt: project.updatedAt, backends: backends.length, statuses, failoverMode: failoverState?.mode ?? 'PRIMARY', recentEvents: events };
    }));
    const [users, deletionRequests] = await Promise.all([this.listUsers(), this.repository.listAccountDeletionRequests()]);
    const metrics = summaries.reduce((total, project) => ({
      projects: total.projects + 1,
      backends: total.backends + project.backends,
      unhealthy: total.unhealthy + (project.statuses.UNHEALTHY ?? 0),
      activeFailovers: total.activeFailovers + (project.failoverMode === 'FAILOVER' ? 1 : 0)
    }), { projects: 0, backends: 0, unhealthy: 0, activeFailovers: 0 });
    return {
      metrics: { ...metrics, users: users.length, disabledUsers: users.filter((user) => user.disabled).length, pendingDeletionRequests: deletionRequests.filter((request) => request.status === 'PENDING').length },
      projects: summaries,
      users,
      deletionRequests
    };
  }

  async listUsers() {
    const users = [];
    let pageToken;
    do {
      const result = await this.auth().listUsers(1000, pageToken);
      users.push(...result.users);
      pageToken = result.pageToken;
    } while (pageToken);
    return users.map(publicUser).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async setUserDisabled(uid, disabled) {
    if (!uid) throw new AppError(400, 'INVALID_USER_ID', 'A user ID is required.');
    const user = await this.auth().updateUser(uid, { disabled });
    return publicUser(user);
  }

  async reviewAccountDeletion(uid, reviewer, decision) {
    if (!this.accountDeletionService) throw new AppError(503, 'ACCOUNT_DELETION_UNAVAILABLE', 'Account deletion review is temporarily unavailable.');
    return this.accountDeletionService.review(uid, reviewer, decision);
  }
}
