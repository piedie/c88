import React, { useState, useEffect } from 'react';
import AdminPage from './AdminPage';
import TeamManagement from './TeamManagement';
import ScoreboardPage from './ScoreboardPage';
import LogbookPage from './LogbookPage';
import TextManagement from './TextManagement';
import AssignmentManagement from './AssignmentManagement'; // Nieuwe import
import '../styles/App.css';

type PageType = 'admin' | 'teams' | 'scoreboard' | 'logbook' | 'texts' | 'assignments' | 'login'; // Voeg 'assignments' toe

const App = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  // Simple but more secure hash function
  const hashPassword = async (pwd: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd + 'c88-salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const ADMIN_PASSWORD_HASH = '513efe29405ad71e77f1c902e1d23e1b2506a63da4e2b3651357952112ae80b3';

  const handleLogin = async () => {
    try {
      const passwordHash = await hashPassword(password);
      
      if (passwordHash === ADMIN_PASSWORD_HASH) {
        setIsAuthenticated(true);
        setCurrentPage('admin');
        localStorage.setItem('c88-admin-auth', 'true');
        setPassword('');
      } else {
        alert('Onjuist wachtwoord');
        setPassword('');
      }
    } catch (error) {
      alert('Fout bij inloggen');
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
      case 'texts':
        return <TextManagement />;
      case 'assignments':
        return <AssignmentManagement />; // Nieuwe case
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
            className={currentPage === 'assignments' ? 'nav-active' : ''}
            onClick={() => handlePageChange('assignments')}
          >
            📝 Opdrachten
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
          <button 
            className={currentPage === 'texts' ? 'nav-active' : ''}
            onClick={() => handlePageChange('texts')}
          >
            🌐 Teksten
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