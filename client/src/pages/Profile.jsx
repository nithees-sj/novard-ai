import React, { useState, useEffect } from 'react';
import { Navigationinner } from '../components/navigationinner';
import Sidebar from '../components/Sidebar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../Firebase';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

const Profile = () => {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setEmail(currentUser.email);
        setUsername(currentUser.displayName || localStorage.getItem('name') || '');
        
        // Fetch additional profile data from backend
        try {
          const response = await axios.get(`${apiUrl}/getUserProfile`, {
            params: { email: currentUser.email }
          });
          if (response.data) {
            setMobile(response.data.mobile || '');
            setBio(response.data.bio || '');
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      // Update localStorage
      localStorage.setItem('name', username);

      // Update backend
      const response = await axios.post(`${apiUrl}/updateUserProfile`, {
        email: email,
        name: username,
        mobile: mobile,
        bio: bio
      });

      if (response.data.success) {
        setMessage('Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Navigationinner title="PROFILE" hideLogo={true} />
      <div className="flex bg-gray-50 min-h-screen pt-14">
        <Sidebar />
        
        {/* Main Content */}
        <div className="ml-64 flex-1 p-8">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
              <p className="text-gray-600">Manage your personal information</p>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {/* Profile Picture Section */}
              <div className="flex items-center mb-8 pb-8 border-b border-gray-200">
                <img
                  src={user?.photoURL || '/img/team/user.jpeg'}
                  alt="Profile"
                  className="w-24 h-24 rounded-full border-4 border-gray-200"
                  onError={(e) => {
                    e.target.src = '/img/team/user.jpeg';
                  }}
                />
                <div className="ml-6">
                  <h2 className="text-xl font-semibold text-gray-900">{username || 'User'}</h2>
                  <p className="text-gray-600 text-sm">{email}</p>
                </div>
              </div>

              {/* Success/Error Message */}
              {message && (
                <div className={`mb-6 p-4 rounded-lg ${
                  message.includes('success') 
                    ? 'bg-green-50 text-green-800 border border-green-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {message}
                </div>
              )}

              {/* Profile Form */}
              <form onSubmit={handleSaveProfile}>
                <div className="space-y-6">
                  {/* Email (Read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="Enter your mobile number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself"
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                    />
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg 
                               transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;
