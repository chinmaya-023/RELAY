export const Loading = ({ label = 'Loading Relay…' }) => <div className="grid min-h-40 place-items-center text-sm text-slate-400">{label}</div>;

export const ErrorState = ({ error }) => <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100"><p className="font-semibold">Something needs attention</p><p className="mt-1 text-rose-100/80">{error?.message ?? 'Relay could not load this resource.'}</p>{error?.requestId && <p className="mt-2 font-mono text-xs opacity-70">Request: {error.requestId}</p>}</div>;

export const StatusPill = ({ status }) => {
  const classes = { HEALTHY: 'bg-emerald-400/15 text-emerald-300', DEGRADED: 'bg-amber-400/15 text-amber-200', UNHEALTHY: 'bg-rose-400/15 text-rose-200', OFFLINE: 'bg-slate-400/15 text-slate-300', UNKNOWN: 'bg-sky-400/15 text-sky-200', PRIMARY: 'bg-sky-400/15 text-sky-200', FAILOVER: 'bg-rose-400/15 text-rose-200' };
  return <span className={`status ${classes[status] ?? 'bg-white/10 text-slate-300'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{(status ?? 'UNKNOWN').replace('_', ' ')}</span>;
};

export const MetricCard = ({ label, value, detail, tone = 'blue' }) => <div className="panel p-5"><p className="label">{label}</p><p className={`mt-3 text-3xl font-semibold tracking-tight ${tone === 'red' ? 'text-rose-200' : tone === 'green' ? 'text-emerald-200' : 'text-white'}`}>{value}</p>{detail && <p className="mt-2 text-sm text-slate-400">{detail}</p>}</div>;

export const EmptyState = ({ title, children, action }) => <div className="panel px-6 py-12 text-center"><h3 className="text-lg font-semibold text-white">{title}</h3>{children && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{children}</p>}{action && <div className="mt-5">{action}</div>}</div>;
