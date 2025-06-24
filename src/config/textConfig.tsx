// src/config/textConfig.ts - Aangepaste versie met database support

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface TextConfig {
  // General
  appTitle: string;
  loading: string;
  
  // Navigation
  navJury: string;
  navTeams: string;
  navLogbook: string;
  navScoreboard: string;
  navLogin: string;
  navLogout: string;
  navTexts: string;
  
  // Login
  loginTitle: string;
  loginSubtitle: string;
  loginPasswordPlaceholder: string;
  loginButton: string;
  loginPublicText: string;
  loginScoreboardButton: string;
  loginWrongPassword: string;
  
  // Admin/Jury
  juryTitle: string;
  jurySelectAssignment: string;
  juryBack: string;
  juryDoublePoints: string;
  juryCreativityPoints: string;
  juryNewGame: string;
  juryTimer: string;
  juryTimerPlaceholder: string;
  jurySetTime: string;
  juryStart: string;
  juryPause: string;
  juryResume: string;
  juryStop: string;
  juryLiveMessages: string;
  juryMessagePlaceholder: string;
  jurySend: string;
  juryClear: string;
  juryQRTitle: string;
  juryQRDescription: string;
  
  // Game states
  gameSetup: string;
  gameReady: string;
  gameRunning: string;
  gamePaused: string;
  gameGrace: string;
  gameFinished: string;
  
  // Categories
  categoryAVFV: string;
  categoryMR: string;
  categoryJEM: string;
}

export interface Language {
  code: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
}

// Fallback teksten als database niet beschikbaar is
export const defaultTexts: TextConfig = {
  appTitle: 'Crazy 88',
  loading: 'Laden...',
  navJury: 'Jury',
  navTeams: 'Teams',
  navLogbook: 'Logboek',
  navScoreboard: 'Scoreboard',
  navLogin: 'Jury login',
  navLogout: 'Uitloggen',
  navTexts: 'Tekst beheer',
  loginTitle: '🎲 Crazy 88 - Jury toegang',
  loginSubtitle: 'Voor toegang tot jury functies is een wachtwoord vereist.',
  loginPasswordPlaceholder: 'Wachtwoord',
  loginButton: 'Inloggen',
  loginPublicText: 'Alleen scoreboard bekijken?',
  loginScoreboardButton: '📊 Naar scoreboard',
  loginWrongPassword: 'Onjuist wachtwoord',
  juryTitle: '👥 Kies team',
  jurySelectAssignment: 'Kies opdracht voor',
  juryBack: '← Terug',
  juryDoublePoints: '🔁 Dubbele punten',
  juryCreativityPoints: '🎨 Creativiteitspunten',
  juryNewGame: '🔄 Nieuw spel starten',
  juryTimer: '⏰ Timer',
  juryTimerPlaceholder: 'Minuten',
  jurySetTime: 'Tijd instellen',
  juryStart: 'Start',
  juryPause: '⏸️ Pauze',
  juryResume: '▶️ Hervat',
  juryStop: '⏹️ Stop',
  juryLiveMessages: '📢 Live berichten',
  juryMessagePlaceholder: 'Bericht voor statistiekenpagina...',
  jurySend: '📤 Verstuur',
  juryClear: '🗑️ Wis',
  juryQRTitle: '📱 QR code voor statistieken',
  juryQRDescription: 'Laat mensen scannen voor live statistieken:',
  categoryAVFV: 'AV/Fotograaf',
  categoryMR: 'Mediaredactie',
  categoryJEM: 'Junior Event Manager',
  gameSetup: '⚙️ Stel eerst een timer in',
  gameReady: '⏳ Klaar om te starten',
  gameRunning: '🔥 Spel loopt!',
  gamePaused: '⏸️ Spel gepauzeerd',
  gameGrace: '⚡ Graceperiode (nog 5 min om punten bij te werken)',
  gameFinished: '🏁 Spel afgelopen - geen punten meer mogelijk',
};

const TextContext = createContext<{
  texts: TextConfig;
  currentLanguage: string;
  availableLanguages: Language[];
  setLanguage: (languageCode: string) => void;
  updateText: (key: keyof TextConfig, value: string) => Promise<void>;
  reloadTexts: () => Promise<void>;
}>({
  texts: defaultTexts,
  currentLanguage: 'nl',
  availableLanguages: [],
  setLanguage: () => {},
  updateText: async () => {},
  reloadTexts: async () => {},
});

export const TextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [texts, setTexts] = useState<TextConfig>(defaultTexts);
  const [currentLanguage, setCurrentLanguage] = useState('nl');
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);

  // Load texts from database
  const loadTexts = async (languageCode: string = currentLanguage) => {
    try {
      const { data: textData } = await supabase
        .from('text_settings')
        .select('text_key, text_value')
        .eq('language_code', languageCode);

      if (textData && textData.length > 0) {
        const loadedTexts: Partial<TextConfig> = {};
        textData.forEach(item => {
          (loadedTexts as any)[item.text_key] = item.text_value;
        });
        
        // Merge with defaults for missing keys
        setTexts({ ...defaultTexts, ...loadedTexts });
      } else {
        setTexts(defaultTexts);
      }
    } catch (error) {
      console.error('Error loading texts:', error);
      setTexts(defaultTexts);
    }
  };

  // Load available languages
  const loadLanguages = async () => {
    try {
      const { data: languagesData } = await supabase
        .from('languages')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (languagesData) {
        setAvailableLanguages(languagesData);
        
        // Set default language if current is not set
        const defaultLang = languagesData.find(lang => lang.is_default);
        if (defaultLang && currentLanguage === 'nl') {
          setCurrentLanguage(defaultLang.code);
        }
      }
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  };

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await loadLanguages();
      await loadTexts();
      setLoading(false);
    };
    
    initialize();
  }, []);

  const setLanguage = async (languageCode: string) => {
    setCurrentLanguage(languageCode);
    localStorage.setItem('c88-language', languageCode);
    await loadTexts(languageCode);
  };

  const updateText = async (key: keyof TextConfig, value: string) => {
    try {
      const { error } = await supabase
        .from('text_settings')
        .upsert({
          language_code: currentLanguage,
          text_key: key,
          text_value: value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'language_code,text_key'
        });

      if (!error) {
        setTexts(prev => ({ ...prev, [key]: value }));
      } else {
        throw error;
      }
    } catch (error) {
      console.error('Error updating text:', error);
      throw error;
    }
  };

  const reloadTexts = async () => {
    await loadTexts();
  };

  // Show loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem'
      }}>
        Laden...
      </div>
    );
  }

  return (
    <TextContext.Provider value={{ 
      texts, 
      currentLanguage, 
      availableLanguages, 
      setLanguage, 
      updateText, 
      reloadTexts 
    }}>
      {children}
    </TextContext.Provider>
  );
};

export const useTexts = () => {
  const context = useContext(TextContext);
  if (!context) {
    throw new Error('useTexts must be used within a TextProvider');
  }
  return context;
};