// Nieuw bestand: src/config/textConfig.ts

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
  jurySelectTeam: string;
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
  
  // Teams
  teamsTitle: string;
  teamsAdd: string;
  teamsName: string;
  teamsCategory: string;
  teamsAddButton: string;
  teamsCurrent: string;
  teamsEdit: string;
  teamsDelete: string;
  teamsSave: string;
  teamsCancel: string;
  teamsDeleteAll: string;
  
  // Scoreboard
  scoreboardTitle: string;
  scoreboardRankings: string;
  scoreboardMinutesPlaying: string;
  scoreboardAssignmentsLast10: string;
  scoreboardAssignmentsDone: string;
  scoreboardUniqueAssignments: string;
  scoreboardCategoryLeaders: string;
  scoreboardFastestTeam: string;
  scoreboardMostCreative: string;
  scoreboardMomentum: string;
  scoreboardCategoryAverage: string;
  scoreboardCategoryTotal: string;
  scoreboardPopular: string;
  scoreboardLiveActivity: string;
  scoreboardToDo: string;
  scoreboardExport: string;
  
  // Logbook
  logbookTitle: string;
  logbookActions: string;
  logbookTotalPoints: string;
  logbookFilter: string;
  logbookRefresh: string;
  logbookCompleted: string;
  logbookNormal: string;
  logbookDouble: string;
  logbookCreativity: string;
  
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

export const defaultTexts: TextConfig = {
  // General
  appTitle: 'Crazy 88',
  loading: 'Laden...',
  
  // Navigation
  navJury: 'Jury',
  navTeams: 'Teams',
  navLogbook: 'Logboek',
  navScoreboard: 'Scoreboard',
  navLogin: 'Jury login',
  navLogout: 'Uitloggen',
  
  // Login
  loginTitle: '🎲 Crazy 88 - Jury toegang',
  loginSubtitle: 'Voor toegang tot jury functies is een wachtwoord vereist.',
  loginPasswordPlaceholder: 'Wachtwoord',
  loginButton: 'Inloggen',
  loginPublicText: 'Alleen scoreboard bekijken?',
  loginScoreboardButton: '📊 Naar scoreboard',
  loginWrongPassword: 'Onjuist wachtwoord',
  
  // Admin/Jury
  juryTitle: '👥 Kies team',
  jurySelectTeam: 'Kies team',
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
  
  // Teams
  teamsTitle: '👥 Team management',
  teamsAdd: '➕ Nieuw team toevoegen',
  teamsName: 'Team naam',
  teamsCategory: 'Opleiding',
  teamsAddButton: 'Toevoegen',
  teamsCurrent: '📋 Huidige teams',
  teamsEdit: '✏️ Bewerken',
  teamsDelete: '🗑️ Verwijderen',
  teamsSave: '✅ Opslaan',
  teamsCancel: '❌ Annuleren',
  teamsDeleteAll: '🗑️ Alle teams wissen',
  
  // Scoreboard
  scoreboardTitle: '🏆 Team rankings',
  scoreboardRankings: 'Team rankings',
  scoreboardMinutesPlaying: 'minuten bezig',
  scoreboardAssignmentsLast10: 'opdrachten laatste 10 min',
  scoreboardAssignmentsDone: 'opdrachten gedaan!',
  scoreboardUniqueAssignments: 'van de 88 unieke opdrachten',
  scoreboardCategoryLeaders: '👑 Opleiding leiders',
  scoreboardFastestTeam: '🚀 Snelste team',
  scoreboardMostCreative: '🎨 Meest creatief',
  scoreboardMomentum: '🔥 Momentum meter',
  scoreboardCategoryAverage: '📊 Opleiding prestaties (gemiddeld)',
  scoreboardCategoryTotal: '🏆 Opleiding totalen (absoluut)',
  scoreboardPopular: '🔥 Populairste opdrachten',
  scoreboardLiveActivity: '⚡ Live activiteit',
  scoreboardToDo: '📝 Nog te doen',
  scoreboardExport: '📄 Exporteer resultaten',
  
  // Logbook
  logbookTitle: '📋 Logboek',
  logbookActions: 'acties',
  logbookTotalPoints: 'totale punten',
  logbookFilter: 'Filter per opleiding:',
  logbookRefresh: '🔄 Vernieuwen',
  logbookCompleted: 'voltooide opdracht',
  logbookNormal: '⭐ Normaal',
  logbookDouble: '🔁 Dubbel',
  logbookCreativity: '🎨 Creativiteit',
  
  // Game states
  gameSetup: '⚙️ Stel eerst een timer in',
  gameReady: '⏳ Klaar om te starten',
  gameRunning: '🔥 Spel loopt!',
  gamePaused: '⏸️ Spel gepauzeerd',
  gameGrace: '⚡ Graceperiode (nog 5 min om punten bij te werken)',
  gameFinished: '🏁 Spel afgelopen - geen punten meer mogelijk',
  
  // Categories
  categoryAVFV: 'AV/Fotograaf',
  categoryMR: 'Mediaredactie',
  categoryJEM: 'Junior Event Manager',
};

// Context for using texts throughout the app
import React, { createContext, useContext, useState } from 'react';

const TextContext = createContext<{
  texts: TextConfig;
  updateTexts: (newTexts: Partial<TextConfig>) => void;
}>({
  texts: defaultTexts,
  updateTexts: () => {},
});

export const TextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [texts, setTexts] = useState<TextConfig>(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('c88-texts');
    return saved ? { ...defaultTexts, ...JSON.parse(saved) } : defaultTexts;
  });

  const updateTexts = (newTexts: Partial<TextConfig>) => {
    const updated = { ...texts, ...newTexts };
    setTexts(updated);
    localStorage.setItem('c88-texts', JSON.stringify(updated));
  };

  return (
    <TextContext.Provider value={{ texts, updateTexts }}>
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