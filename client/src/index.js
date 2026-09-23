import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import axios from 'axios';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Requests previously had no timeout at all, so an unreachable API (or a
// database the server cannot select) left every spinner running indefinitely.
// Generous, because plan generation legitimately runs for a minute or more.
axios.defaults.timeout = 120000;

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

if (!process.env.REACT_APP_API_ENDPOINT) {
  console.error(
    'REACT_APP_API_ENDPOINT is not set. Add it to client/.env (e.g. http://localhost:5000) ' +
    'and restart the dev server - every API call will fail without it.'
  );
}

if (!googleClientId) {
  // Without this the sign-in button renders but silently does nothing.
  console.error(
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
