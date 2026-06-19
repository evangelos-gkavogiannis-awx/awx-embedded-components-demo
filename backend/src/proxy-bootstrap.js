/**
 * proxy-bootstrap.js — loaded via --import before server.js.
 *
 * Forces Node.js native fetch (undici) to route all outbound HTTP/HTTPS
 * through the egress proxy when HTTP_PROXY is set in the environment.
 *
 * Hosts listed in NO_PROXY bypass the proxy and connect directly — this
 * is intentional: undici's ProxyAgent does not read NO_PROXY automatically.
 *
 * This file is managed by the AirForge system. Do not modify it.
 */
import { setGlobalDispatcher, ProxyAgent, Agent } from 'undici';

const proxyUrl = process.env.HTTP_PROXY || process.env.http_proxy;
if (proxyUrl) {
  const noProxyList = (process.env.NO_PROXY || process.env.no_proxy || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  const proxy = new ProxyAgent(proxyUrl);
  const direct = new Agent();

  // Route requests: bypass proxy for hosts in NO_PROXY, proxy everything else.
  setGlobalDispatcher({
    dispatch(options, handler) {
      const hostname = options.hostname ?? new URL(options.origin).hostname;
      const bypass = noProxyList.some((h) => hostname === h || hostname.endsWith(`.${h}`));
      return (bypass ? direct : proxy).dispatch(options, handler);
    },
    close() {
      return Promise.all([proxy.close(), direct.close()]);
    },
    destroy() {
      return Promise.all([proxy.destroy(), direct.destroy()]);
    },
  });

  console.log(`[proxy] Node.js fetch → ${proxyUrl} (bypass: ${noProxyList.join(', ') || 'none'})`);
}
