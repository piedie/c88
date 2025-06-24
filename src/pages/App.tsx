import React, { useState, useEffect } from 'react';
import AdminPage from './AdminPage';
import TeamManagement from './TeamManagement';
import ScoreboardPage from './ScoreboardPage';
import LogbookPage from './LogbookPage';
import '../styles/App.css';

type PageType = 'admin' | 'teams' | 'scoreboard' | 'logbook' | 'login';

const App = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  // Simple hash function for password (you can also use a more secure one)
  const hashPassword = (pwd: string): string => {
    let hash = 0;
    for (let i = 0; i < pwd.length; i++) {
      const char = pwd.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  };

  // Hash of "" is "-1169789239" - change this to your desired password hash
  const ADMIN_PASSWORD_HASH = '-1067928817'; 

  // To generate a new hash, uncomment this line and check console:
  //console.log('Hash for "kkk":', hashPassword('mynewpassword'));

  const handleLogin = () => {
    const passwordHash = hashPassword(password);
    if (passwordHash === ADMIN_PASSWORD_HASH) {
      setIsAuthenticated(true);
      setCurrentPage('admin');
      localStorage.setItem('c88-admin-auth', 'true');
      setPassword('');
    } else {
      alert('Onjuist wachtwoord');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage('login');
    localStorage.removeItem('c88-admin-auth');
    window.location.hash = '';
  };

  const handlePageChange = (page: PageType) => {
    if (page === 'scoreboard') {
      window.location.hash = '#scoreboard';
    } else {
      window.location.hash = '';
    }
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'admin':
        return <AdminPage />;
      case 'teams':
        return <TeamManagement />;
      case 'scoreboard':
        return <ScoreboardPage />;
      case 'logbook':
        return <LogbookPage />;
      case 'login':
        return (
          <div className="login-container">
            <div className="login-box">
              <h1>🎲 Crazy 88 - Jury toegang</h1>
              <p>Voor toegang tot jury functies is een wachtwoord vereist.</p>
              <div className="login-form">
                <input
                  type="password"
                  placeholder="Wachtwoord"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
                <button onClick={handleLogin}>Inloggen</button>
              </div>
              <div className="public-access">
                <p>Alleen scoreboard bekijken?</p>
                <button 
                  className="scoreboard-btn"
                  onClick={() => handlePageChange('scoreboard')}
                >
                  📊 Naar scoreboard
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return <AdminPage />;
    }
  };

  // If viewing scoreboard publicly, show minimal interface
  if (currentPage === 'scoreboard' && !isAuthenticated) {
    return (
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <h1>🎲 Crazy 88 - Live statistieken</h1>
          </div>
          <div className="nav-links">
            <button onClick={() => setCurrentPage('login')}>
              🔐 Jury login
            </button>
          </div>
        </nav>
        <main className="main-content">
          <ScoreboardPage />
        </main>
      </div>
    );
  }

  // Full authenticated interface
  if (!isAuthenticated) {
    return (
      <div className="app">
        {renderPage()}
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          <h1>🎲 Crazy 88 - Jury panel</h1>
        </div>
        <div className="nav-links">
          <button 
            className={currentPage === 'admin' ? 'nav-active' : ''}
            onClick={() => handlePageChange('admin')}
          >
            🎯 Jury
          </button>
          <button 
            className={currentPage === 'teams' ? 'nav-active' : ''}
            onClick={() => handlePageChange('teams')}
          >
            👥 Teams
          </button>
          <button 
            className={currentPage === 'logbook' ? 'nav-active' : ''}
            onClick={() => handlePageChange('logbook')}
          >
            📋 Logboek
          </button>
          <button 
            className={currentPage === 'scoreboard' ? 'nav-active' : ''}
            onClick={() => handlePageChange('scoreboard')}
          >
            📊 Scoreboard
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Uitloggen
          </button>
        </div>
      </nav>
      
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;