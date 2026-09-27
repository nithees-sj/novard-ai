const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../app');
const User = require('../../models/user');
const { env } = require('../../config/env');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, bearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();

const CLIENT_ID = 'test-client.apps.googleusercontent.com';

/** Stub Google's tokeninfo and userinfo endpoints. */
function mockGoogle({ tokeninfo, tokeninfoStatus = 200, userinfo = { name: 'Alice Learner', picture: 'https://pic/a.png' } }) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const isTokeninfo = String(url).includes('tokeninfo');
    return new Response(JSON.stringify(isTokeninfo ? tokeninfo : userinfo), {
      status: isTokeninfo ? tokeninfoStatus : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

afterEach(() => jest.restoreAllMocks());

describe('POST /api/auth/google', () => {
  const valid = { aud: CLIENT_ID, azp: CLIENT_ID, email: ALICE.email, email_verified: 'true' };

  it('verifies the Google token, creates the account and returns a session', async () => {
    mockGoogle({ tokeninfo: valid });
    const res = await request(app).post('/api/auth/google').send({ accessToken: 'google-token' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: ALICE.email, name: 'Alice Learner', picture: 'https://pic/a.png' });
    const payload = jwt.verify(res.body.token, env.jwtSecret, { audience: 'novard-ai-web', issuer: 'novard-ai' });
    expect(payload.sub).toBe(ALICE.email);
    expect(await User.countDocuments({ email: ALICE.email })).toBe(1);
  });

  it('keeps the name a returning student set on their profile', async () => {
    await User.create({ email: ALICE.email, name: 'Custom Name' });
    mockGoogle({ tokeninfo: valid });
    const res = await request(app).post('/api/auth/google').send({ accessToken: 'google-token' });
    expect(res.body.user.name).toBe('Custom Name');
    expect(await User.countDocuments()).toBe(1);
  });

  it('rejects a token issued to another OAuth client', async () => {
    mockGoogle({ tokeninfo: { ...valid, aud: 'someone-else', azp: 'someone-else' } });
    const res = await request(app).post('/api/auth/google').send({ accessToken: 'google-token' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects an unverified email', async () => {
    mockGoogle({ tokeninfo: { ...valid, email_verified: 'false' } });
    const res = await request(app).post('/api/auth/google').send({ accessToken: 'google-token' });
    expect(res.status).toBe(401);
  });

  it('rejects a token Google does not accept', async () => {
    mockGoogle({ tokeninfo: { error: 'invalid_token' }, tokeninfoStatus: 400 });
    const res = await request(app).post('/api/auth/google').send({ accessToken: 'expired' });
    expect(res.status).toBe(401);
  });

  it('requires an access token', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'accessToken is required.', code: 'BAD_REQUEST' });
  });

  it('reports Google being unreachable as a 502', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const res = await request(app).post('/api/auth/google').send({ accessToken: 'google-token' });
    expect(res.status).toBe(502);
  });
});

describe('sessions', () => {
  it('GET /api/auth/me returns the signed-in student', async () => {
    await User.create({ email: ALICE.email, name: ALICE.name, bio: 'Hi' });
    const res = await request(app).get('/api/auth/me').set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: ALICE.email, name: ALICE.name, bio: 'Hi' });
  });

  it('refuses requests without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/sign in/i);
  });

  it('refuses an expired token', async () => {
    const expired = jwt.sign({ name: 'A' }, env.jwtSecret, {
      subject: ALICE.email, issuer: 'novard-ai', audience: 'novard-ai-web', expiresIn: -10,
    });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
  });

  it('refuses a token signed with another secret', async () => {
    const forged = jwt.sign({ name: 'A' }, 'not-the-secret', { subject: ALICE.email, issuer: 'novard-ai', audience: 'novard-ai-web' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /updateUserProfile', () => {
  beforeEach(() => User.create({ email: ALICE.email, name: ALICE.name }));

  it('updates the signed-in student and returns a fresh token with the new name', async () => {
    const res = await request(app)
      .post('/updateUserProfile')
      .set('Authorization', bearer())
      .send({ email: ALICE.email, name: 'Alice New', mobile: '+44 7700 900123', bio: 'Learning Docker' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, user: { name: 'Alice New', mobile: '+44 7700 900123', bio: 'Learning Docker' } });
    expect(jwt.decode(res.body.token).name).toBe('Alice New');
  });

  it('cannot update another student', async () => {
    const res = await request(app).post('/updateUserProfile').set('Authorization', bearer()).send({ email: 'bob@example.com', name: 'Hacked' });
    expect(res.status).toBe(403);
    expect((await User.findOne({ email: ALICE.email })).name).toBe(ALICE.name);
  });

  it('validates the phone number', async () => {
    const res = await request(app).post('/updateUserProfile').set('Authorization', bearer()).send({ mobile: 'call me' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please enter a valid phone number.');
  });
});
