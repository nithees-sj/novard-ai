// SUPERADMIN_EMAILS is read once when config/env.js loads, so set it first.
process.env.SUPERADMIN_EMAILS = 'boss@example.com';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../app');
const User = require('../../models/user');
const AdminAuditLog = require('../../models/adminAuditLog');
const { env } = require('../../config/env');
const { setRole } = require('../../services/adminUserService');
const { useTestDatabase } = require('../helpers/db');
const { ALICE, BOB, ADA, ROOT, bearer, adminBearer, superadminBearer } = require('../helpers/auth');

useTestDatabase();
const app = createApp();

const CLIENT_ID = 'test-client.apps.googleusercontent.com';

function mockGoogle(email) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (url) => new Response(JSON.stringify(
    String(url).includes('tokeninfo')
      ? { aud: CLIENT_ID, azp: CLIENT_ID, email, email_verified: 'true' }
      : { name: 'Someone', picture: '' }
  ), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

afterEach(() => jest.restoreAllMocks());

describe('POST /api/admin/auth/google', () => {
  it('refuses a student: clear message and no admin token', async () => {
    await User.create({ email: ALICE.email, name: ALICE.name });
    mockGoogle(ALICE.email);
    const res = await request(app).post('/api/admin/auth/google').send({ accessToken: 'g' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_ADMIN');
    expect(res.body.error).toMatch(/not a Novard-AI admin/);
    expect(res.body.token).toBeUndefined();
  });

  it('signs an admin in with a separate, shorter-lived admin token', async () => {
    await User.create({ email: ADA.email, name: ADA.name, role: 'admin' });
    mockGoogle(ADA.email);
    const res = await request(app).post('/api/admin/auth/google').send({ accessToken: 'g' });
    expect(res.status).toBe(200);
    expect(res.body.admin).toMatchObject({ email: ADA.email, role: 'admin' });
    const payload = jwt.verify(res.body.token, env.jwtSecret, { audience: 'novard-ai-admin', issuer: 'novard-ai' });
    expect(payload.role).toBe('admin');
    expect(payload.exp - payload.iat).toBe(12 * 3600);
  });

  it('refuses a suspended admin', async () => {
    await User.create({ email: ADA.email, role: 'admin', status: 'suspended' });
    mockGoogle(ADA.email);
    const res = await request(app).post('/api/admin/auth/google').send({ accessToken: 'g' });
    expect(res.status).toBe(403);
    expect(res.body.token).toBeUndefined();
  });

  it('makes SUPERADMIN_EMAILS accounts superadmin on sign-in, and audits it', async () => {
    mockGoogle('boss@example.com');
    const res = await request(app).post('/api/admin/auth/google').send({ accessToken: 'g' });
    expect(res.status).toBe(200);
    expect(res.body.admin.role).toBe('superadmin');
    expect((await User.findOne({ email: 'boss@example.com' })).role).toBe('superadmin');
    expect(await AdminAuditLog.countDocuments({ action: 'user.role.bootstrap' })).toBe(1);
  });
});

describe('admin sessions', () => {
  it('rejects a student token on admin routes, and an admin token on student routes', async () => {
    expect((await request(app).get('/api/admin/auth/me').set('Authorization', bearer())).status).toBe(401);
    const admin = await adminBearer();
    expect((await request(app).get('/api/auth/me').set('Authorization', admin)).status).toBe(401);
    expect((await request(app).get('/api/admin/auth/me')).status).toBe(401);
  });

  it('reads the role from the database: a demoted admin loses access on the next request', async () => {
    const admin = await adminBearer();
    expect((await request(app).get('/api/admin/auth/me').set('Authorization', admin)).body.admin.role).toBe('admin');
    await User.updateOne({ email: ADA.email }, { role: 'student' });
    const res = await request(app).get('/api/admin/auth/me').set('Authorization', admin);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ADMIN_REVOKED');
  });

  it('a suspended admin loses access on the next request', async () => {
    const admin = await adminBearer();
    await User.updateOne({ email: ADA.email }, { status: 'suspended' });
    expect((await request(app).get('/api/admin/settings').set('Authorization', admin)).status).toBe(401);
  });

  it('/api/auth/me returns the role, so the app can show the admin link', async () => {
    await User.create({ email: ADA.email, name: ADA.name, role: 'admin' });
    const res = await request(app).get('/api/auth/me').set('Authorization', bearer(ADA));
    expect(res.body.user.role).toBe('admin');
  });
});

describe('suspended students', () => {
  it('are signed out on their next request with a friendly message', async () => {
    await User.create({ email: ALICE.email, name: ALICE.name, status: 'suspended' });
    const res = await request(app).get('/api/auth/me').set('Authorization', bearer());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    expect(res.body.error).toMatch(/suspended/);
  });

  it('cannot sign in again', async () => {
    await User.create({ email: ALICE.email, status: 'suspended' });
    mockGoogle(ALICE.email);
    const res = await request(app).post('/api/auth/google').send({ accessToken: 'g' });
    expect(res.status).toBe(403);
    expect(res.body.token).toBeUndefined();
  });

  it('a student with no account row (older sessions) still works', async () => {
    const res = await request(app).get('/api/app-status').set('Authorization', bearer(BOB));
    expect(res.status).toBe(200);
  });
});

describe('roles and suspension', () => {
  it('only a superadmin can grant admin', async () => {
    const admin = await adminBearer();
    const bob = await User.create({ email: BOB.email, name: BOB.name });
    const res = await request(app).post(`/api/admin/users/${bob._id}/role`).set('Authorization', admin).send({ role: 'admin' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SUPERADMIN_ONLY');

    const root = await superadminBearer();
    const ok = await request(app).post(`/api/admin/users/${bob._id}/role`).set('Authorization', root).send({ role: 'admin' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe('admin');
    const entry = await AdminAuditLog.findOne({ action: 'user.role' }).lean();
    expect(entry).toMatchObject({ adminId: ROOT.email, before: { role: 'student' }, after: { role: 'admin' } });
  });

  it('an admin can suspend a student but not another admin', async () => {
    const admin = await adminBearer();
    const bob = await User.create({ email: BOB.email });
    const other = await User.create({ email: 'other@example.com', role: 'admin' });

    const ok = await request(app).post(`/api/admin/users/${bob._id}/suspend`).set('Authorization', admin).send({ reason: 'spam' });
    expect(ok.body.user).toMatchObject({ status: 'suspended', suspendedReason: 'spam' });
    const no = await request(app).post(`/api/admin/users/${other._id}/suspend`).set('Authorization', admin);
    expect(no.status).toBe(403);

    const back = await request(app).post(`/api/admin/users/${bob._id}/reactivate`).set('Authorization', admin);
    expect(back.body.user.status).toBe('active');
    expect(await AdminAuditLog.countDocuments({ action: { $in: ['user.suspend', 'user.reactivate'] } })).toBe(2);
  });

  it('nobody can change their own role or suspend themselves', async () => {
    const root = await superadminBearer();
    const me = await User.findOne({ email: ROOT.email });
    expect((await request(app).post(`/api/admin/users/${me._id}/role`).set('Authorization', root).send({ role: 'admin' })).status).toBe(403);
    expect((await request(app).post(`/api/admin/users/${me._id}/suspend`).set('Authorization', root)).status).toBe(403);
  });

  it('never demotes or suspends the last active superadmin', async () => {
    await User.create({ email: ROOT.email, role: 'superadmin' });
    await expect(setRole('cli', ROOT.email, 'admin')).rejects.toMatchObject({ status: 409, code: 'LAST_SUPERADMIN' });

    await User.create({ email: 'second@example.com', role: 'superadmin' });
    await expect(setRole('cli', ROOT.email, 'admin')).resolves.toMatchObject({ role: 'admin' });
  });

  it('validates the role and the user id', async () => {
    const root = await superadminBearer();
    const bob = await User.create({ email: BOB.email });
    expect((await request(app).post(`/api/admin/users/${bob._id}/role`).set('Authorization', root).send({ role: 'owner' })).status).toBe(400);
    expect((await request(app).post('/api/admin/users/not-an-id/role').set('Authorization', root).send({ role: 'admin' })).status).toBe(400);
  });
});

describe('GET /api/admin/audit-log', () => {
  it('lists entries newest first and filters by action', async () => {
    const root = await superadminBearer();
    const bob = await User.create({ email: BOB.email });
    await request(app).post(`/api/admin/users/${bob._id}/role`).set('Authorization', root).send({ role: 'admin' });
    await request(app).post(`/api/admin/users/${bob._id}/suspend`).set('Authorization', root);

    const all = await request(app).get('/api/admin/audit-log').set('Authorization', root);
    expect(all.body.total).toBe(2);
    expect(all.body.entries[0].action).toBe('user.suspend');
    const filtered = await request(app).get('/api/admin/audit-log?action=user.role').set('Authorization', root);
    expect(filtered.body.entries.map((e) => e.action)).toEqual(['user.role']);
  });
});

describe('one Google sign-in for students and admins', () => {
  it('a student gets only the student session, exactly as before', async () => {
    await User.create({ email: ALICE.email, name: ALICE.name });
    mockGoogle(ALICE.email);
    const res = await request(app).post('/api/auth/google').send({ accessToken: 'g' });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['token', 'user']);
    expect(res.body.user.role).toBe('student');
  });

  it('an admin also gets an admin console session from "Continue with Google"', async () => {
    await User.create({ email: ADA.email, name: ADA.name, role: 'admin' });
    mockGoogle(ADA.email);
    const res = await request(app).post('/api/auth/google').send({ accessToken: 'g' });
    expect(res.body.user.role).toBe('admin');
    expect(res.body.admin.admin).toMatchObject({ email: ADA.email, role: 'admin' });
    // Two separate sessions: each works only where it belongs.
    expect((await request(app).get('/api/admin/auth/me').set('Authorization', `Bearer ${res.body.admin.token}`)).status).toBe(200);
    expect((await request(app).get('/api/admin/auth/me').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.admin.token}`)).status).toBe(401);
  });

  it('a SUPERADMIN_EMAILS account is an admin from its very first sign-in', async () => {
    mockGoogle('boss@example.com');
    const res = await request(app).post('/api/auth/google').send({ accessToken: 'g' });
    expect(res.body.user.role).toBe('superadmin');
    expect(res.body.admin.admin.role).toBe('superadmin');
  });

  it('POST /api/auth/admin-session: admins only, read from the database', async () => {
    await User.create([{ email: ADA.email, name: ADA.name, role: 'admin' }, { email: ALICE.email, name: ALICE.name }]);
    const ok = await request(app).post('/api/auth/admin-session').set('Authorization', bearer(ADA));
    expect(ok.status).toBe(200);
    expect(ok.body.admin.role).toBe('admin');
    expect((await request(app).get('/api/admin/auth/me').set('Authorization', `Bearer ${ok.body.token}`)).status).toBe(200);

    const student = await request(app).post('/api/auth/admin-session').set('Authorization', bearer(ALICE));
    expect(student.status).toBe(403);
    expect(student.body.code).toBe('NOT_ADMIN');
    expect(student.body.token).toBeUndefined();

    await User.updateOne({ email: ADA.email }, { role: 'student' });
    expect((await request(app).post('/api/auth/admin-session').set('Authorization', bearer(ADA))).status).toBe(403);
    await User.updateOne({ email: ADA.email }, { role: 'admin', status: 'suspended' });
    expect((await request(app).post('/api/auth/admin-session').set('Authorization', bearer(ADA))).status).toBe(403);
    expect((await request(app).post('/api/auth/admin-session')).status).toBe(401);
  });
});
