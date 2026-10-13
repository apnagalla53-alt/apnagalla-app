const samples: { at: number; elapsed: number; failed: boolean }[] = [];
export const runtimeMetrics = {
  record(elapsed: number, status: number) {
    samples.push({ at: Date.now(), elapsed, failed: status >= 500 });
    while (samples.length > 2000 || (samples[0] && samples[0].at < Date.now() - 300_000)) samples.shift();
  },
  snapshot() {
    const current = samples.filter(s => s.at >= Date.now() - 300_000);
    return { window_seconds: 300, sampled_requests: current.length, sample_limit: 2000,
      server_error_rate_percent: current.length ? current.filter(s => s.failed).length / current.length * 100 : null,
      average_latency_ms: current.length ? current.reduce((sum, s) => sum + s.elapsed, 0) / current.length : null };
  },
};
