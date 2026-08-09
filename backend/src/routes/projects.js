import { Router } from 'express';
import { resourceEtag, sendVersioned } from '../lib/etag.js';
import { AppError } from '../lib/errors.js';
import { createProjectSchema, projectIdSchema, updateProjectSchema } from '../schemas/index.js';
import { requireScope } from '../middleware/auth.js';

const ensureOwner = (project) => {
  if (project.role !== 'OWNER' && project.role !== 'ADMIN') throw new AppError(403, 'PROJECT_WRITE_DENIED', 'Your project role cannot change this resource.');
};

export const createProjectRouter = ({ repository, resources }) => {
  const router = Router();

  router.get('/', requireScope('project:read'), async (request, response) => {
    const allProjects = await repository.listProjects(request.user.uid);
    const data = request.user.projectId ? allProjects.filter((project) => project.id === request.user.projectId) : allProjects;
    const version = data.reduce((latest, item) => Math.max(latest, item.version ?? 0), 0);
    const etag = resourceEtag('projects', request.user.uid, `${version}-${data.length}`);
    response.set({ ETag: etag, 'Cache-Control': 'private, max-age=0, must-revalidate' });
    if (request.headers['if-none-match'] === etag) return response.status(304).end();
    return response.json({ success: true, data, meta: { version } });
  });

  router.post('/', requireScope('project:write'), async (request, response) => {
    if (request.user.projectId) throw new AppError(403, 'API_KEY_PROJECT_DENIED', 'A project-scoped API key cannot create projects.');
    const project = await repository.createProject(request.user.uid, createProjectSchema.parse(request.body));
    resources.invalidateProject(project.id, request.user.uid);
    return response.status(201).json({ success: true, data: project, meta: { version: project.version } });
  });

  router.get('/:id', requireScope('project:read'), async (request, response) => {
    const { id } = projectIdSchema.parse(request.params);
    const project = await resources.projectForUser(id, request.user.uid, request.user.projectId);
    return sendVersioned(request, response, { type: 'project', id, version: project.version, data: project });
  });

  router.patch('/:id', requireScope('project:write'), async (request, response) => {
    const { id } = projectIdSchema.parse(request.params);
    ensureOwner(await resources.projectForUser(id, request.user.uid, request.user.projectId));
    const project = await repository.updateProject(id, request.user.uid, updateProjectSchema.parse(request.body));
    resources.invalidateProject(id, request.user.uid);
    return response.json({ success: true, data: project, meta: { version: project.version } });
  });

  router.delete('/:id', requireScope('project:write'), async (request, response) => {
    const { id } = projectIdSchema.parse(request.params);
    await resources.projectForUser(id, request.user.uid, request.user.projectId);
    await repository.deleteProject(id, request.user.uid);
    resources.invalidateProject(id, request.user.uid);
    return response.status(204).end();
  });

  return router;
};

export { ensureOwner };
