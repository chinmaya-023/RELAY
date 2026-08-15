import { randomUUID } from 'node:crypto';

export const requestId = (request, response, next) => {
  // Do not let callers choose a log correlation ID: a client-controlled value can
  // collide with or forge another request's audit trail.
  if (!request.id) request.id = `relay_${randomUUID()}`;
  response.set('X-Request-ID', request.id);
  next();
};
