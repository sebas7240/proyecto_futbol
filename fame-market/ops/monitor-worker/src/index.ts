import {
  readMonitorState,
  runMonitor,
  type MonitorState
} from './monitor';

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/') {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    const state: MonitorState | null = await readMonitorState(env);
    return Response.json(
      state ?? {
        state: 'pending',
        environment: env.ENVIRONMENT,
        message: 'El primer chequeo programado aun no se ha ejecutado.'
      },
      {
        headers: {
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff'
        }
      }
    );
  },

  async scheduled(_controller, env): Promise<void> {
    try {
      await runMonitor(env);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'health_check_failed',
          environment: env.ENVIRONMENT,
          error: error instanceof Error ? error.message : String(error)
        })
      );
      throw error;
    }
  }
} satisfies ExportedHandler<Env>;
