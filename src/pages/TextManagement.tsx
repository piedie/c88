// src/pages/TextManagement.tsx - Aangepaste versie met database

import React, { useState, useEffect } from 'react';
import { useTexts, TextConfig, defaultTexts } from '../config/textConfig';
import { supabase } from '../lib/supabaseClient';

const TextManagement = () => {
  const { texts, currentLanguage, availableLanguages, setLanguage, updateText, reloadTexts } = useTexts();
  const [editedTexts, setEditedTexts] = useState<TextConfig>(texts);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyChanged, setShowOnlyChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLanguageCode, setNewLanguageCode] = useState('');
  const [newLanguageName, setNewLanguageName] = useState('');
  const [showAddLanguage, setShowAddLanguage] = useState(false);

  useEffect(() => {
    setEditedTexts(texts);
  }, [texts, currentLanguage]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes = Object.entries(editedTexts).filter(
        ([key, value]) => value !== texts[key as keyof TextConfig]
      );

      for (const [key, value] of changes) {
        await updateText(key as keyof TextConfig, value);
      }
      
      alert(`${changes.length} teksten opgeslagen voor ${currentLanguage}!`);
    } catch (error) {
      alert('Fout bij opslaan van teksten');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLanguage = async () => {
    if (!newLanguageCode || !newLanguageName) return;
    
    try {
      // Add new language
      const { error: langError } = await supabase
        .from('languages')
        .insert({
          code: newLanguageCode.toLowerCase(),
          name: newLanguageName,
          is_active: true,
          is_default: false
        });

      if (langError) throw langError;

      // Copy all texts from current language to new language
      const textEntries = Object.entries(editedTexts);
      const textInserts = textEntries.map(([key, value]) => ({
        language_code: newLanguageCode.toLowerCase(),
        text_key: key,
        text_value: value
      }));

      const { error: textError } = await supabase
        .from('text_settings')
        .insert(textInserts);

      if (textError) throw textError;

      alert('Nieuwe taal toegevoegd!');
      setNewLanguageCode('');
      setNewLanguageName('');
      setShowAddLanguage(false);
      await reloadTexts();
    } catch (error) {
      alert('Fout bij toevoegen van taal');
    }
  };

  const handleChange = (key: keyof TextConfig, value: string) => {
    setEditedTexts(prev => ({ ...prev, [key]: value }));
  };

  const isTextChanged = (key: keyof TextConfig) => {
    return editedTexts[key] !== texts[key];
  };

  const getFilteredTexts = () => {
    const entries = Object.entries(editedTexts) as [keyof TextConfig, string][];
    
    return entries.filter(([key, value]) => {
      const matchesSearch = searchTerm === '' || 
        key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        value.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isChanged = showOnlyChanged ? isTextChanged(key) : true;
      
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

  const changedCount = Object.keys(editedTexts).filter(key => 
    isTextChanged(key as keyof TextConfig)
  ).length;

  return (
    <div className="page-container">
      <h2>📝 Tekst beheer</h2>
      
      {/* Language selector */}
      <div className="language-section">
        <h3>🌍 Taal selectie</h3>
        <div className="language-controls">
          <div className="current-language">
            <label>Huidige taal:</label>
            <select 
              value={currentLanguage} 
              onChange={(e) => setLanguage(e.target.value)}
              className="language-select"
            >
              {availableLanguages.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} {lang.is_default ? '(standaard)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={() => setShowAddLanguage(!showAddLanguage)}
            className="add-language-btn"
          >
            ➕ Nieuwe taal
          </button>
        </div>

        {showAddLanguage && (
          <div className="add-language-form">
            <input
              type="text"
              placeholder="Taalcode (bijv. 'fr', 'de')"
              value={newLanguageCode}
              onChange={(e) => setNewLanguageCode(e.target.value)}
              maxLength={5}
            />
            <input
              type="text"
              placeholder="Taalnaam (bijv. 'Français', 'Deutsch')"
              value={newLanguageName}
              onChange={(e) => setNewLanguageName(e.target.value)}
            />
            <button 
              onClick={handleAddLanguage}
              disabled={!newLanguageCode || !newLanguageName}
            >
              Toevoegen
            </button>
            <button onClick={() => setShowAddLanguage(false)}>
              Annuleren
            </button>
          </div>
        )}
      </div>
      
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
            Alleen aangepaste teksten tonen ({changedCount})
          </label>
        </div>
        
        <div className="action-buttons">
          <button 
            onClick={handleSave} 
            className="save-btn"
            disabled={saving || changedCount === 0}
          >
            {saving ? '💾 Bezig...' : `💾 Opslaan (${changedCount})`}
          </button>
          <button onClick={reloadTexts} className="reload-btn">
            🔄 Herladen
          </button>
        </div>
      </div>

      <div className="current-language-info">
        <p>
          <strong>Bezig met:</strong> {availableLanguages.find(l => l.code === currentLanguage)?.name || currentLanguage}
          {changedCount > 0 && (
            <span className="unsaved-changes"> - {changedCount} niet-opgeslagen wijzigingen</span>
          )}
        </p>
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
                    {isTextChanged(key) && <span className="changed-indicator">*</span>}
                  </label>
                  <div className="text-input-container">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="text-input"
                    />
                    {isTextChanged(key) && (
                      <button
                        onClick={() => handleChange(key, texts[key])}
                        className="reset-single-btn"
                        title="Reset naar opgeslagen versie"
                      >
                        ↶
                      </button>
                    )}
                  </div>
                  {isTextChanged(key) && (
                    <div className="original-text">
                      Opgeslagen: "{texts[key]}"
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