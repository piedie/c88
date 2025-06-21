import React, { useState } from 'react';
import AdminPage from './AdminPage';
import TeamManagement from './TeamManagement';
import ScoreboardPage from './ScoreboardPage';
import LogbookPage from './LogbookPage';
import '../styles/App.css';

type PageType = 'admin' | 'teams' | 'scoreboard' | 'logbook';

const App = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('admin');

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
      default:
        return <AdminPage />;
    }
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          <h1>🎲 Crazy 88</h1>
        </div>
        <div className="nav-links">
          <button 
            className={currentPage === 'admin' ? 'nav-active' : ''}
            onClick={() => setCurrentPage('admin')}
          >
            🎯 Admin/Jury
          </button>
          <button 
            className={currentPage === 'teams' ? 'nav-active' : ''}
            onClick={() => setCurrentPage('teams')}
          >
            👥 Teams
          </button>
          <button 
            className={currentPage === 'logbook' ? 'nav-active' : ''}
            onClick={() => setCurrentPage('logbook')}
          >
            📋 Logboek
          </button>
          <button 
            className={currentPage === 'scoreboard' ? 'nav-active' : ''}
            onClick={() => setCurrentPage('scoreboard')}
          >
            📊 Scoreboard
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