'use strict';

/**
 * Live reload via SSE: the editor iframe subscribes to /events
 * and the save endpoint broadcasts a 'reload' with the project name.
 */

const clients = new Set();

/** @returns {boolean} true when this request was the SSE subscription. */
function handle(req, res, url) {
  if (req.method !== 'GET' || url.pathname !== '/events') return false;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('retry: 5000\n\n');
  // Heartbeat: keeps proxies/OS from silently killing the stream, so the
  // client does not fall into a reconnect storm (was: retry 1500, no ping).
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
  clients.add(res);
  req.on('close', () => { clearInterval(keepAlive); clients.delete(res); });
  return true;
}

function broadcast(event, data = '') {
  for (const res of clients) {
    res.write(`event: ${event}\ndata: ${data}\n\n`);
  }
}

module.exports = { handle, broadcast };
