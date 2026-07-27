import React from 'react';
import { useAuth } from '../AuthContext';

function UserProfile() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    user && (
      <div>
        <img src={user.picture} alt="Profile" />
        <h2>{user.name}</h2>
        <h3>{user.email}</h3>
      </div>
    )
  );
}

export default UserProfile;
