export const validate = (schema, target = 'body') => (request, _response, next) => {
  request[target] = schema.parse(request[target]);
  next();
};
