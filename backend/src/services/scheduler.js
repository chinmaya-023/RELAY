import { logger } from '../lib/logger.js';

export class MonitoringScheduler {
  #timer;
  #lastRun = new Map();

  constructor(repository, monitoringService, tickMs = 15_000) {
    this.repository = repository;
    this.monitoringService = monitoringService;
    this.tickMs = tickMs;
  }

  async tick() {
    const monitors = await this.repository.listEnabledMonitors();
    const now = Date.now();
    await Promise.all(monitors.map(async (monitor) => {
      const intervalMs = monitor.intervalSeconds * 1000;
      const lastRun = this.#lastRun.get(monitor.backendId) ?? 0;
      if (now - lastRun < intervalMs) return;
      this.#lastRun.set(monitor.backendId, now);
      try { await this.monitoringService.checkBackend(monitor.backendId); }
      catch (error) { logger.error('scheduled_health_check_failed', { backendId: monitor.backendId, code: error.code, message: error.message }); }
    }));
  }

  start() {
    if (this.#timer) return;
    this.#timer = setInterval(() => this.tick().catch((error) => logger.error('scheduler_tick_failed', { message: error.message })), this.tickMs);
    this.tick().catch((error) => logger.error('scheduler_start_failed', { message: error.message }));
  }

  stop() { if (this.#timer) clearInterval(this.#timer); this.#timer = undefined; }
}
