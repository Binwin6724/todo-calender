import React, { useEffect, useState } from 'react';
import './GoogleLogin.css';

const GoogleLogin = ({ onLoginSuccess, onLoginError }) => {
  const [isLoading, setIsLoading] = useState(false);

  const initializeGoogleSignIn = () => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com',
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        {
          theme: 'outline',
          size: 'large',
          width: 300,
          text: 'signin_with',
          shape: 'rectangular',
        }
      );
    }
  };

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleSignIn;
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [initializeGoogleSignIn]);

  const handleCredentialResponse = async (response) => {
    setIsLoading(true);
    try {
      // Decode the JWT token to get user info
      const userInfo = parseJwt(response.credential);
      
      const userData = {
        id: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        token: response.credential,
      };

      onLoginSuccess(userData);
    } catch (error) {
      console.error('Login error:', error);
      onLoginError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      throw new Error('Invalid token');
    }
  };

  return (
    <div className="google-login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-container">
            <div className="app-logo">📅</div>
            <h1 className="app-title">Todo Calendar</h1>
          </div>
          <p className="login-subtitle">
            Sign in to access your personal todo calendar and sync across devices
          </p>
        </div>

        <div className="login-content">
          <div className="login-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">🔄</span>
              <span>Sync across all devices</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">📱</span>
              <span>Access anywhere, anytime</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🔒</span>
              <span>Secure cloud storage</span>
            </div>
          </div>

          <div className="google-signin-wrapper">
            {isLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>Signing you in...</span>
              </div>
            ) : (
              <>
                <div id="google-signin-button"></div>
                <p className="signin-note">
                  By signing in, you agree to our terms of service and privacy policy
                </p>
              </>
            )}
          </div>
        </div>

        <div className="login-footer">
          <p className="footer-text">
            New to Todo Calendar? Signing in will create your account automatically
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoogleLogin;
