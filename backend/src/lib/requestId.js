import { randomUUID } from 'node:crypto';

export const requestId = (request, response, next) => {
  const supplied = request.get('x-request-id');
  request.id = supplied && /^[A-Za-z0-9_-]{8,128}$/.test(supplied) ? supplied : `relay_${randomUUID()}`;
  response.set('X-Request-ID', request.id);
  next();
};
