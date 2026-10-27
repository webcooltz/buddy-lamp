// Run with `npm test` (from /server). Uses a throwaway data dir so real messages are untouched.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buddy-lamp-spec-'));
process.env.BUDDY_LAMP_DATA_DIR = dataDir;
const SECRET = 'spec-secret-123';
process.env.BUDDY_LAMP_SECRET = SECRET;

const app = require('../index');

const messagesPath = (family) => path.join(dataDir, `messages-${family}.json`);

function request(port, method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const allHeaders = payload ? { 'Content-Type': 'application/json', ...headers } : headers;
    const req = http.request({ port, method, path: urlPath, headers: allHeaders }, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (e) { /* not JSON */ }
        resolve({ status: res.statusCode, json, raw, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('buddy-lamp server', () => {
  let server;
  let port;

  beforeAll((done) => {
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      fs.rmSync(dataDir, { recursive: true, force: true });
      done();
    });
  });

  beforeEach(() => {
    fs.readdirSync(dataDir).forEach((f) => fs.rmSync(path.join(dataDir, f), { force: true }));
  });

  const auth = (family = 'fam1', secret = SECRET) => ({ 'X-Buddy-Secret': secret, 'X-Buddy-Family': family });
  const get = (family) => request(port, 'GET', '/messages', { headers: auth(family) });
  const post = (household, family) => request(port, 'POST', '/messages', { body: { household }, headers: auth(family) });

  describe('colors', () => {
    it('returns white when there are no messages', async () => {
      const res = await get();
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ color: 'white' });
    });

    it('returns white when the messages file is empty', async () => {
      fs.writeFileSync(messagesPath('fam1'), '');
      expect((await get()).json).toEqual({ color: 'white' });
    });

    it('returns the color of the last message', async () => {
      expect((await post({ name: 'a', color: 'red' })).status).toBe(201);
      expect((await post({ name: 'b', color: 'blue' })).status).toBe(201);
      expect((await get()).json).toEqual({ color: 'blue' });
    });

    it('assigns incrementing ids', async () => {
      await post({ name: 'a', color: 'red' });
      await post({ name: 'a', color: 'green' });
      const saved = JSON.parse(fs.readFileSync(messagesPath('fam1'), 'utf8'));
      expect(saved.map((m) => m.id)).toEqual([1, 2]);
    });

    it('treats legacy messages without a household as white', async () => {
      fs.writeFileSync(messagesPath('fam1'), JSON.stringify([{ id: 1, date: '2025-01-01T00:00:00Z' }]));
      expect((await get()).json).toEqual({ color: 'white' });
      expect((await post({ name: 'a', color: 'red' })).status).toBe(201);
    });

    it('caps stored messages', async () => {
      for (let i = 0; i < 105; i++) {
        await post({ name: 'a', color: i % 2 ? 'red' : 'blue' });
      }
      const saved = JSON.parse(fs.readFileSync(messagesPath('fam1'), 'utf8'));
      expect(saved.length).toBe(100);
      expect(saved[saved.length - 1].id).toBe(105);
    });
  });

  describe('families', () => {
    it('keeps each family color separate', async () => {
      await post({ name: 'a', color: 'red' }, 'smiths');
      await post({ name: 'b', color: 'blue' }, 'joneses');
      expect((await get('smiths')).json).toEqual({ color: 'red' });
      expect((await get('joneses')).json).toEqual({ color: 'blue' });
      expect((await get('nobody')).json).toEqual({ color: 'white' });
    });

    it('ignores family case and whitespace', async () => {
      await post({ name: 'a', color: 'red' }, 'Smiths');
      expect((await get('smiths')).json).toEqual({ color: 'red' });
    });

    it('rejects missing or unsafe family names with 400', async () => {
      const bad = ['', '../etc', 'a/b', 'a b', 'x'.repeat(33)];
      for (const family of bad) {
        expect((await get(family)).status).toBe(400);
      }
    });
  });

  describe('auth', () => {
    it('rejects a missing or wrong secret with 401', async () => {
      expect((await request(port, 'GET', '/messages', { headers: { 'X-Buddy-Family': 'fam1' } })).status).toBe(401);
      expect((await request(port, 'GET', '/messages', { headers: auth('fam1', 'wrong') })).status).toBe(401);
      expect((await request(port, 'POST', '/messages', {
        body: { household: { name: 'a', color: 'red' } }, headers: auth('fam1', 'wrong')
      })).status).toBe(401);
    });

    it('does not save anything for unauthorized posts', async () => {
      await request(port, 'POST', '/messages', {
        body: { household: { name: 'a', color: 'red' } }, headers: auth('fam1', 'wrong')
      });
      expect(fs.existsSync(messagesPath('fam1'))).toBe(false);
    });

    it('fails closed when the server has no secret configured', async () => {
      delete process.env.BUDDY_LAMP_SECRET;
      try {
        expect((await get()).status).toBe(500);
      } finally {
        process.env.BUDDY_LAMP_SECRET = SECRET;
      }
    });
  });

  describe('validation', () => {
    it('rejects an invalid color with 400', async () => {
      expect((await post({ name: 'a', color: 'purple' })).status).toBe(400);
    });

    it('rejects a missing household with 400 instead of crashing', async () => {
      expect((await request(port, 'POST', '/messages', { body: {}, headers: auth() })).status).toBe(400);
    });

    it('rejects a missing or too-long name', async () => {
      expect((await post({ color: 'red' })).status).toBe(400);
      expect((await post({ name: '', color: 'red' })).status).toBe(400);
      expect((await post({ name: 'x'.repeat(33), color: 'red' })).status).toBe(400);
      expect((await post({ name: 'x'.repeat(32), color: 'red' })).status).toBe(201);
    });

    it('rejects malformed JSON with 400', async () => {
      expect((await request(port, 'POST', '/messages', { body: '{nope', headers: auth() })).status).toBe(400);
    });

    it('rejects oversized bodies', async () => {
      const res = await request(port, 'POST', '/messages', {
        body: { household: { name: 'a', color: 'red', junk: 'x'.repeat(20000) } }, headers: auth()
      });
      expect(res.status).toBe(413);
    });

    it('returns 500 (not a crash) when a messages file is corrupt', async () => {
      fs.writeFileSync(messagesPath('fam1'), '{not json');
      expect((await get()).status).toBe(500);
      expect((await post({ name: 'a', color: 'red' })).status).toBe(500);
    });
  });

  describe('misc routes', () => {
    it('serves /health without auth', async () => {
      const res = await request(port, 'GET', '/health');
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ status: 'ok' });
    });

    it('returns 404 for unknown routes of any method', async () => {
      expect((await request(port, 'GET', '/nope')).status).toBe(404);
      expect((await request(port, 'POST', '/nope', { body: {} })).status).toBe(404);
    });

    it('does not send CORS headers', async () => {
      const res = await request(port, 'GET', '/messages', { headers: auth() });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('shutdown', () => {
    it('closes the server and calls back', (done) => {
      const extra = app.listen(0, () => {
        app.shutdown(extra, () => {
          expect(extra.listening).toBe(false);
          done();
        });
      });
    });
  });
});
