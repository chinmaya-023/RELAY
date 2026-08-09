const redactHeaders = (headers = {}) => {
  const clone = { ...headers };
  for (const key of Object.keys(clone)) {
    if (/authorization|cookie|api[-_]?key|secret/i.test(key)) clone[key] = '[redacted]';
  }
  return clone;
};

export const logger = {
  info(event, fields = {}) { console.info(JSON.stringify({ level: 'info', event, timestamp: new Date().toISOString(), ...fields })); },
  warn(event, fields = {}) { console.warn(JSON.stringify({ level: 'warn', event, timestamp: new Date().toISOString(), ...fields })); },
  error(event, fields = {}) { console.error(JSON.stringify({ level: 'error', event, timestamp: new Date().toISOString(), ...fields })); },
  redactHeaders
};
