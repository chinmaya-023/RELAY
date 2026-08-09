export const resourceEtag = (type, id, version) => `"${type}-${id}-v${version}"`;

export const isFresh = (request, etag) => request.headers['if-none-match'] === etag;

export const sendVersioned = (request, response, { type, id, version, data, cacheControl = 'private, max-age=0, must-revalidate' }) => {
  const etag = resourceEtag(type, id, version);
  response.set({ ETag: etag, 'Cache-Control': cacheControl });
  if (isFresh(request, etag)) return response.status(304).end();
  return response.json({ success: true, data, meta: { version } });
};
