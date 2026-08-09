import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider.jsx';
import { EmptyState, ErrorState, Loading, MetricCard, StatusPill } from '../components/ui.jsx';

const useProjects = () => {
  const { api } = useAuth();
  return useQuery({ queryKey: ['projects'], queryFn: () => api.get('/api/projects') });
};

const useDashboard = () => {
  const { api } = useAuth();
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/api/dashboard') });
};

export const ProjectCreateForm = ({ onCreated }) => {
  const { api } = useAuth();
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useMutation({ mutationFn: () => api.post('/api/projects', { name, description }), onSuccess: (result) => { client.invalidateQueries({ queryKey: ['projects'] }); client.invalidateQueries({ queryKey: ['dashboard'] }); onCreated?.(result.data); setName(''); setDescription(''); } });
  return <form className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/20 p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}><input className="field mt-0" placeholder="Project name" value={name} onChange={(event) => setName(event.target.value)} minLength="2" maxLength="80" required /><input className="field mt-0" placeholder="A short description (optional)" value={description} onChange={(event) => setDescription(event.target.value)} maxLength="280" /><button className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'New project'}</button>{create.error && <p className="sm:col-span-3 text-sm text-rose-200">{create.error.message}</p>}</form>;
};

export const Dashboard = () => {
  const dashboard = useDashboard();
  const data = dashboard.data?.data;
  if (dashboard.isLoading) return <Loading />;
  if (dashboard.error) return <ErrorState error={dashboard.error} />;
  const { projects, metrics, recentEvents } = data;
  return <div className="space-y-8"><section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="label text-relay-400">Control plane</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Operational clarity, from one place.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Relay monitors the backends you register, applies controlled gateway policies, and makes health-driven failover visible.</p></div><Link className="btn-secondary" to="/projects">View projects</Link></section><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Healthy backends" value={metrics.healthy} detail={`${metrics.totalBackends} registered`} tone="green" /><MetricCard label="Degraded" value={metrics.degraded} detail={`${metrics.unavailable} unavailable`} tone={metrics.degraded || metrics.unavailable ? 'red' : 'blue'} /><MetricCard label="Average latency" value={metrics.averageLatencyMs === null ? '—' : `${metrics.averageLatencyMs} ms`} detail="Most recent successful checks" /><MetricCard label="Active failovers" value={metrics.activeFailovers} detail="Health-state driven" tone={metrics.activeFailovers ? 'red' : 'blue'} /></section><section className="panel p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-white">Your projects</h2><p className="mt-1 text-sm text-slate-400">Start with a project, then register a public backend.</p></div></div><ProjectCreateForm onCreated={() => {}} />{projects.length ? <div className="mt-5 divide-y divide-white/10">{projects.slice(0, 5).map((project) => <Link key={project.id} className="flex items-center justify-between gap-4 py-4 transition hover:px-2" to={`/projects/${project.id}`}><div><p className="font-medium text-white">{project.name}</p><p className="mt-1 text-sm text-slate-400">{project.backends.length} backend{project.backends.length === 1 ? '' : 's'} · {project.description || 'No description'}</p></div><div className="flex items-center gap-3"><StatusPill status={project.failoverState?.mode ?? 'UNKNOWN'} /><span className="text-sm text-relay-400">Open →</span></div></Link>)}</div> : <div className="mt-5"><EmptyState title="No projects yet">Create a project to set up monitoring, a controlled gateway, and optional failover.</EmptyState></div>}</section><section className="panel p-5"><h2 className="font-semibold">Recent operational events</h2>{recentEvents.length ? <div className="mt-4 divide-y divide-white/10">{recentEvents.slice(0, 5).map((event) => <div className="flex items-start justify-between gap-4 py-3" key={event.id}><div><p className="text-sm font-medium">{event.type.replaceAll('_', ' ')}</p><p className="mt-1 text-sm text-slate-400">{event.projectName} · {event.message}</p></div><time className="shrink-0 text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</time></div>)}</div> : <p className="mt-3 text-sm text-slate-400">Events will appear after monitoring detects a state change.</p>}</section></div>;
};

export const Projects = () => {
  const projects = useProjects();
  const data = projects.data?.data ?? [];
  if (projects.isLoading) return <Loading />;
  if (projects.error) return <ErrorState error={projects.error} />;
  return <div className="space-y-6"><div><p className="label text-relay-400">Projects</p><h1 className="mt-2 text-3xl font-semibold">Reliability workspaces</h1></div><ProjectCreateForm onCreated={() => {}} /><div className="grid gap-4 lg:grid-cols-2">{data.map((project) => <Link key={project.id} to={`/projects/${project.id}`} className="panel p-5 transition hover:-translate-y-0.5 hover:border-relay-400/40"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-white">{project.name}</h2><p className="mt-2 text-sm text-slate-400">{project.description || 'No description yet.'}</p></div><StatusPill status="UNKNOWN" /></div><p className="mt-6 text-xs font-medium text-slate-500">Updated {new Date(project.updatedAt).toLocaleDateString()}</p></Link>)}</div>{!data.length && <EmptyState title="Create your first project">A project groups the backends, gateway policy, monitoring, and failover configuration for one application.</EmptyState>}</div>;
};
