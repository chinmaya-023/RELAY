import { Router } from 'express';
import { requireScope } from '../middleware/auth.js';

export const createDashboardRouter = ({ repository }) => {
  const router = Router();
  router.get('/dashboard', requireScope('project:read'), async (request, response) => {
    const allProjects = await repository.listProjects(request.user.uid);
    const projects = request.user.projectId ? allProjects.filter((project) => project.id === request.user.projectId) : allProjects;
    const details = await Promise.all(projects.map(async (project) => {
      const backends = await repository.listBackends(project.id);
      const [withHealth, failoverState, events] = await Promise.all([
        Promise.all(backends.map(async (backend) => ({ ...backend, health: await repository.getHealth(backend.id) }))),
        repository.getFailoverState(project.id),
        repository.listEvents(project.id, 10)
      ]);
      return { ...project, backends: withHealth, failoverState, events };
    }));
    const allBackends = details.flatMap((project) => project.backends);
    const counts = allBackends.reduce((result, backend) => {
      const status = backend.health?.status ?? 'UNKNOWN';
      result[status] = (result[status] ?? 0) + 1;
      return result;
    }, {});
    const latencies = allBackends.map((backend) => backend.health?.lastLatencyMs).filter(Number.isFinite);
    const recentEvents = details.flatMap((project) => project.events.map((event) => ({ ...event, projectName: project.name }))).sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
    return response.json({
      success: true,
      data: {
        projects: details,
        metrics: {
          totalBackends: allBackends.length,
          healthy: counts.HEALTHY ?? 0,
          degraded: counts.DEGRADED ?? 0,
          unavailable: (counts.UNHEALTHY ?? 0) + (counts.OFFLINE ?? 0),
          activeFailovers: details.filter((project) => project.failoverState?.mode === 'FAILOVER').length,
          averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length) : null
        },
        recentEvents
      }
    });
  });
  return router;
};
