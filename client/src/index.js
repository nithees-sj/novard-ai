import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import logger from './lib/logger';

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Request timeouts and the session token are applied in lib/api.js.
if (!process.env.REACT_APP_API_ENDPOINT) {
  logger.error(
    'REACT_APP_API_ENDPOINT is not set. Add it to client/.env (e.g. http://localhost:5000) ' +
    'and restart the dev server - every API call will fail without it.'
  );
}

if (!googleClientId) {
  // Without this the sign-in button renders but silently does nothing.
  logger.error(
    'REACT_APP_GOOGLE_CLIENT_ID is not set. Add it to client/.env and restart the dev server, ' +
    'otherwise Google sign-in cannot work.'
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId || ''}>
        <App />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
