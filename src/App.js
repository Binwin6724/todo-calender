import React from 'react';
import './App.css';
import TodoCalendarApp from './Todo/TodoCalendarApp';
import GoogleLogin from './components/GoogleLogin';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Main App Content Component
const AppContent = () => {
  const { isAuthenticated, isLoading, login, logout, user } = useAuth();

  const handleLoginSuccess = (userData) => {
    login(userData);
  };

  const handleLoginError = (error) => {
    console.error('Login failed:', error);
    alert('Login failed. Please try again.');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="App">
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="App">
        <GoogleLogin 
          onLoginSuccess={handleLoginSuccess}
          onLoginError={handleLoginError}
        />
      </div>
    );
  }

  // Show main app if authenticated
  return (
    <div className="App">
      {/* User info bar */}
      <div style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '0.75rem 1rem',
        borderRadius: '2rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        {user?.picture && (
          <img 
            src={user.picture} 
            alt={user.name}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '2px solid #e5e7eb'
            }}
          />
        )}
        <span style={{
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151'
        }}>
          {user?.name}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            padding: '0.25rem 0.75rem',
            fontSize: '0.75rem',
            color: '#6b7280',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.background = '#f3f4f6';
            e.target.style.color = '#374151';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = '#6b7280';
          }}
        >
          Logout
        </button>
      </div>
      
      <TodoCalendarApp />
    </div>
  );
};

// Main App Component with Auth Provider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
