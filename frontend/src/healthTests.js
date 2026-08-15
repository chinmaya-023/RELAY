import { useSyncExternalStore } from 'react';

const idle = Object.freeze({ status: 'IDLE' });
const tests = new Map();
const listeners = new Set();
const publish = () => listeners.forEach((listener) => listener());
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
const snapshot = (backendId) => tests.get(backendId) ?? idle;

const finish = (backendId, state) => {
  tests.set(backendId, state);
  publish();
};

export const useBackendHealthTest = (backendId) => {
  const state = useSyncExternalStore(subscribe, () => snapshot(backendId), () => idle);
  const start = (api, onComplete) => {
    if (['RUNNING', 'CANCELLING'].includes(snapshot(backendId).status)) return;
    const controller = new AbortController();
    finish(backendId, { status: 'RUNNING', controller });
    api.post(`/api/backends/${backendId}/test`, undefined, { signal: controller.signal })
      .then((result) => {
        finish(backendId, { status: 'COMPLETED', result: result.data, completedAt: Date.now() });
        onComplete?.();
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.code === 'REQUEST_CANCELLED' || error?.name === 'AbortError') finish(backendId, { status: 'CANCELLED', completedAt: Date.now() });
        else finish(backendId, { status: 'FAILED', error, completedAt: Date.now() });
      });
  };
  const cancel = () => {
    if (snapshot(backendId).status !== 'RUNNING') return;
    const current = snapshot(backendId);
    finish(backendId, { ...current, status: 'CANCELLING' });
    current.controller.abort();
  };
  return { state, start, cancel };
};
