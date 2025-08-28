import { useState, useEffect, createContext, useContext } from 'react';

// Create Auth Context
const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing user session on app load
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const storedUser = localStorage.getItem('todoapp_user');
        const storedToken = localStorage.getItem('todoapp_token');
        
        if (storedUser && storedToken) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        // Clear invalid data
        localStorage.removeItem('todoapp_user');
        localStorage.removeItem('todoapp_token');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Login function
  const login = async (userData) => {
    try {
      // Store token first
      localStorage.setItem('todoapp_token', userData.token);
      
      // Fetch updated user data from backend (includes stored image URL)
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001/api'}/auth/verify`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userData.token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          const backendUserData = result.user;
          
          setUser(backendUserData);
          setIsAuthenticated(true);
          
          // Store updated user data from backend
          localStorage.setItem('todoapp_user', JSON.stringify({
            id: backendUserData.id,
            name: backendUserData.name,
            email: backendUserData.email,
            picture: backendUserData.picture
          }));
          
          console.log('User logged in successfully with stored image:', backendUserData.name);
        } else {
          // Fallback to original user data if backend call fails
          setUser(userData);
          setIsAuthenticated(true);
          localStorage.setItem('todoapp_user', JSON.stringify({
            id: userData.id,
            name: userData.name,
            email: userData.email,
            picture: userData.picture
          }));
          console.log('User logged in with fallback data:', userData.name);
        }
      } catch (fetchError) {
        console.error('Error fetching updated user data:', fetchError);
        // Fallback to original user data
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('todoapp_user', JSON.stringify({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          picture: userData.picture
        }));
      }
    } catch (error) {
      console.error('Error during login:', error);
    }
  };

  // Logout function
  const logout = () => {
    try {
      setUser(null);
      setIsAuthenticated(false);
      
      // Clear stored data
      localStorage.removeItem('todoapp_user');
      localStorage.removeItem('todoapp_token');
      
      // Sign out from Google
      if (window.google && window.google.accounts) {
        window.google.accounts.id.disableAutoSelect();
      }
      
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Get stored token
  const getToken = () => {
    return localStorage.getItem('todoapp_token');
  };

  // Check if token is expired (basic check)
  const isTokenExpired = () => {
    const token = getToken();
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    getToken,
    isTokenExpired
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
