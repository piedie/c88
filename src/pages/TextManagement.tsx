// Nieuw bestand: src/pages/TextManagement.tsx

import React, { useState } from 'react';
import { useTexts, defaultTexts, TextConfig } from '../config/textConfig';

const TextManagement = () => {
  const { texts, updateTexts } = useTexts();
  const [editedTexts, setEditedTexts] = useState<TextConfig>(texts);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyChanged, setShowOnlyChanged] = useState(false);

  const handleSave = () => {
    updateTexts(editedTexts);
    alert('Teksten opgeslagen!');
  };

  const handleReset = () => {
    if (confirm('Weet je zeker dat je alle teksten wilt resetten naar de standaardwaarden?')) {
      setEditedTexts(defaultTexts);
      updateTexts(defaultTexts);
    }
  };

  const handleChange = (key: keyof TextConfig, value: string) => {
    setEditedTexts(prev => ({ ...prev, [key]: value }));
  };

  const getFilteredTexts = () => {
    const entries = Object.entries(editedTexts) as [keyof TextConfig, string][];
    
    return entries.filter(([key, value]) => {
      const matchesSearch = searchTerm === '' || 
        key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        value.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isChanged = showOnlyChanged ? value !== defaultTexts[key] : true;
      
      return matchesSearch && isChanged;
    });
  };

  const getTextCategory = (key: string) => {
    if (key.startsWith('nav')) return 'Navigatie';
    if (key.startsWith('login')) return 'Inloggen';
    if (key.startsWith('jury')) return 'Jury/Admin';
    if (key.startsWith('teams')) return 'Teams';
    if (key.startsWith('scoreboard')) return 'Scoreboard';
    if (key.startsWith('logbook')) return 'Logboek';
    if (key.startsWith('game')) return 'Spel status';
    if (key.startsWith('category')) return 'Opleidingen';
    return 'Algemeen';
  };

  const groupedTexts = getFilteredTexts().reduce((acc, [key, value]) => {
    const category = getTextCategory(key);
    if (!acc[category]) acc[category] = [];
    acc[category].push([key, value]);
    return acc;
  }, {} as Record<string, [keyof TextConfig, string][]>);

  return (
    <div className="page-container">
      <h2>📝 Tekst beheer</h2>
      
      <div className="text-management-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Zoek teksten..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showOnlyChanged}
              onChange={(e) => setShowOnlyChanged(e.target.checked)}
            />
            Alleen aangepaste teksten tonen
          </label>
        </div>
        
        <div className="action-buttons">
          <button onClick={handleSave} className="save-btn">
            💾 Opslaan
          </button>
          <button onClick={handleReset} className="reset-btn">
            🔄 Reset naar standaard
          </button>
        </div>
      </div>

      <div className="text-categories">
        {Object.entries(groupedTexts).map(([category, items]) => (
          <div key={category} className="text-category">
            <h3>{category}</h3>
            <div className="text-items">
              {items.map(([key, value]) => (
                <div key={key} className="text-item">
                  <label className="text-label">
                    {key}
                    {value !== defaultTexts[key] && <span className="changed-indicator">*</span>}
                  </label>
                  <div className="text-input-container">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="text-input"
                    />
                    {value !== defaultTexts[key] && (
                      <button
                        onClick={() => handleChange(key, defaultTexts[key])}
                        className="reset-single-btn"
                        title="Reset naar standaard"
                      >
                        ↶
                      </button>
                    )}
                  </div>
                  {value !== defaultTexts[key] && (
                    <div className="original-text">
                      Origineel: "{defaultTexts[key]}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(groupedTexts).length === 0 && (
        <div className="no-results">
          <p>Geen teksten gevonden met de huidige filters.</p>
        </div>
      )}
    </div>
  );
};

export default TextManagement;