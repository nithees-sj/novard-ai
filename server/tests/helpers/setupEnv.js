// Runs before every test file (jest.setupFiles), before any app module is loaded.
process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), `novard-test-uploads-${process.pid}`);
