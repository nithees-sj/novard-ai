import { saveSession, restoreSession, clearSession, getToken, currentEmail, currentName } from '../session';

describe('session storage', () => {
  it('saves the token and profile, including the older keys pages still read', () => {
    const user = saveSession({ token: 'tok', user: { name: 'Alice', email: 'alice@example.com', picture: 'p.png' } });
    expect(user).toMatchObject({ name: 'Alice', email: 'alice@example.com', displayName: 'Alice', photoURL: 'p.png' });
    expect(getToken()).toBe('tok');
    expect(localStorage.getItem('email')).toBe('alice@example.com');
    expect(currentEmail()).toBe('alice@example.com');
    expect(currentName()).toBe('Alice');
    expect(restoreSession()).toMatchObject({ email: 'alice@example.com' });
  });

  it('drops a session saved before sign-in used tokens', () => {
    localStorage.setItem('auth_user', JSON.stringify({ email: 'alice@example.com' }));
    localStorage.setItem('email', 'alice@example.com');
    expect(restoreSession()).toBeNull();
    expect(localStorage.getItem('email')).toBeNull();
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('auth_user', '{not json');
    localStorage.setItem('auth_token', 'tok');
    expect(restoreSession()).toBeNull();
  });

  it('clears everything on sign-out', () => {
    saveSession({ token: 'tok', user: { name: 'A', email: 'a@b.c' } });
    clearSession();
    expect(localStorage.length).toBe(0);
  });
});
