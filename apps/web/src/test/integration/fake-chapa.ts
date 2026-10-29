import { createServer, type Server } from 'node:http';

/**
 * A minimal stand-in for the Chapa HTTP API so the backend's REAL Chapa provider code runs.
 * Start the backend with CHAPA_BASE_URL pointing at this server.
 */
export interface FakeChapa {
  server: Server;
  initialized: Map<string, { amount: string; currency: string }>;
  paid: Set<string>;
  close: () => Promise<void>;
}

export function startFakeChapa(port: number): Promise<FakeChapa> {
  const initialized = new Map<string, { amount: string; currency: string }>();
  const paid = new Set<string>();

  const server = createServer((req, res) => {
    let body = '';

    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const send = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (req.method === 'POST' && req.url === '/v1/transaction/initialize') {
        const payload = JSON.parse(body) as { tx_ref: string; amount: string; currency: string };

        initialized.set(payload.tx_ref, { amount: payload.amount, currency: payload.currency });

        return send(200, {
          message: 'Hosted Link',
          status: 'success',
          data: { checkout_url: `https://checkout.chapa.co/checkout/payment/${payload.tx_ref}` },
        });
      }

      const verify = req.url?.match(/^\/v1\/transaction\/verify\/(.+)$/);

      if (verify && req.method === 'GET') {
        const txRef = decodeURIComponent(verify[1]);
        const sent = initialized.get(txRef);

        if (!sent || !paid.has(txRef)) {
          return send(400, { message: 'Transaction not found', status: 'failed', data: null });
        }

        return send(200, {
          message: 'Payment details fetched successfully',
          status: 'success',
          data: { status: 'success', amount: sent.amount, currency: sent.currency, tx_ref: txRef, reference: `CH-${txRef.slice(-8)}`, method: 'telebirr' },
        });
      }

      return send(404, {});
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () =>
      resolve({ server, initialized, paid, close: () => new Promise((done) => server.close(() => done())) }),
    );
  });
}
