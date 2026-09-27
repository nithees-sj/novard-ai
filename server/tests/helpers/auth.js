const { issueSessionToken } = require('../../services/authService');

const ALICE = { email: 'alice@example.com', name: 'Alice Learner' };
const BOB = { email: 'bob@example.com', name: 'Bob Student' };

/** `Authorization` header value for a signed-in student. */
const bearer = (user = ALICE) => `Bearer ${issueSessionToken(user)}`;

module.exports = { ALICE, BOB, bearer };
