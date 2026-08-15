import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const isPrivateIpv4 = (address) => {
  const [a, b] = address.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
};

export const isProhibitedAddress = (address) => {
  const type = net.isIP(address);
  if (type === 4) return isPrivateIpv4(address);
  if (type !== 6) return true;
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return Boolean(mapped && isPrivateIpv4(mapped[1]));
};

export const parseOutboundUrl = (value) => {
  let url;
  try { url = new URL(value); } catch { throw new AppError(400, 'INVALID_ORIGIN_URL', 'Origin URL must be a valid absolute URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new AppError(400, 'INVALID_ORIGIN_URL', 'Origin URL must use HTTP(S) and must not include credentials.');
  if (url.protocol === 'http:' && !env.allowHttpBackends) throw new AppError(400, 'INSECURE_ORIGIN_URL', 'Backend origins must use HTTPS in this environment.');
  if (url.port && !/^\d{1,5}$/.test(url.port)) throw new AppError(400, 'INVALID_ORIGIN_URL', 'Origin URL has an invalid port.');
  return url;
};

export const resolvePublicDestination = async (value) => {
  const url = value instanceof URL ? value : parseOutboundUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  if (net.isIP(hostname)) addresses = [{ address: hostname }];
  else {
    try { addresses = await dns.lookup(hostname, { all: true, verbatim: true }); }
    catch { throw new AppError(400, 'ORIGIN_DNS_UNRESOLVABLE', 'Origin hostname could not be resolved.'); }
  }
  if (!addresses.length || addresses.some(({ address }) => isProhibitedAddress(address))) {
    throw new AppError(400, 'ORIGIN_PRIVATE_NETWORK_DENIED', 'Origin must resolve exclusively to public network addresses.');
  }
  return { url, addresses };
};
