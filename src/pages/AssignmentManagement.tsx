import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Assignment {
  id: string;
  number: number;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  category: 'general' | 'social' | 'creative' | 'physical' | 'challenge';
  points_base: number;
  estimated_time: number;
  location_type: 'anywhere' | 'indoor' | 'outdoor' | 'specific';
  is_active: boolean;
  requires_photo: boolean;
  requires_video: boolean;
  requires_audio: boolean;
  special_instructions?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

const AssignmentManagement = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'number' | 'difficulty' | 'category'>('number');

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .order('number', { ascending: true });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAssignment = async (id: string, updates: Partial<Assignment>) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      setAssignments(prev => 
        prev.map(assignment => 
          assignment.id === id 
            ? { ...assignment, ...updates }
            : assignment
        )
      );
    } catch (error) {
      console.error('Error updating assignment:', error);
      alert('Fout bij opslaan van opdracht');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-orange-100 text-orange-800';
      case 'extreme': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'social': return '👥';
      case 'creative': return '🎨';
      case 'physical': return '💪';
      case 'challenge': return '🎯';
      default: return '📝';
    }
  };

  const getDifficultyEmoji = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '😊';
      case 'medium': return '😐';
      case 'hard': return '😤';
      case 'extreme': return '🔥';
      default: return '❓';
    }
  };

  const getPointsColor = (points: number) => {
    switch (points) {
      case 1: return 'text-blue-600';
      case 2: return 'text-purple-600';
      case 3: return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const filteredAndSortedAssignments = assignments
    .filter(assignment => {
      const matchesSearch = assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           assignment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           assignment.number.toString().includes(searchTerm);
      
      const matchesCategory = filterCategory === 'all' || assignment.category === filterCategory;
      const matchesDifficulty = filterDifficulty === 'all' || assignment.difficulty === filterDifficulty;
      
      return matchesSearch && matchesCategory && matchesDifficulty;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'number': return a.number - b.number;
        case 'difficulty': 
          const diffOrder = { 'easy': 1, 'medium': 2, 'hard': 3, 'extreme': 4 };
          return diffOrder[a.difficulty] - diffOrder[b.difficulty];
        case 'category': return a.category.localeCompare(b.category);
        default: return a.number - b.number;
      }
    });

  const toggleActive = async (assignment: Assignment) => {
    await updateAssignment(assignment.id, { is_active: !assignment.is_active });
  };

  const InlineEditor = ({ assignment, field, type = 'text' }: { 
    assignment: Assignment; 
    field: keyof Assignment; 
    type?: 'text' | 'textarea' | 'select' | 'number' | 'checkbox';
  }) => {
    const [value, setValue] = useState(assignment[field]);
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = async () => {
      if (value !== assignment[field]) {
        await updateAssignment(assignment.id, { [field]: value } as Partial<Assignment>);
      }
      setIsEditing(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && type !== 'textarea') {
        handleSave();
      }
      if (e.key === 'Escape') {
        setValue(assignment[field]);
        setIsEditing(false);
      }
    };

    if (!isEditing) {
      return (
        <span 
          onClick={() => setIsEditing(true)}
          className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded"
          title="Klik om te bewerken"
        >
          {type === 'checkbox' ? (assignment[field] ? '✅' : '❌') : String(assignment[field] || '')}
        </span>
      );
    }

    if (type === 'textarea') {
      return (
        <textarea
          value={String(value || '')}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyPress}
          className="w-full p-1 border rounded text-sm"
          rows={3}
          autoFocus
        />
      );
    }

    if (type === 'select' && field === 'difficulty') {
      return (
        <select
          value={String(value)}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          className="p-1 border rounded text-sm"
          autoFocus
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="extreme">Extreme</option>
        </select>
      );
    }

    if (type === 'select' && field === 'category') {
      return (
        <select
          value={String(value)}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          className="p-1 border rounded text-sm"
          autoFocus
        >
          <option value="general">General</option>
          <option value="social">Social</option>
          <option value="creative">Creative</option>
          <option value="physical">Physical</option>
          <option value="challenge">Challenge</option>
        </select>
      );
    }

    if (type === 'number') {
      return (
        <input
          type="number"
          value={Number(value)}
          onChange={(e) => setValue(parseInt(e.target.value))}
          onBlur={handleSave}
          onKeyDown={handleKeyPress}
          className="w-16 p-1 border rounded text-sm"
          autoFocus
        />
      );
    }

    if (type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => {
            setValue(e.target.checked);
            updateAssignment(assignment.id, { [field]: e.target.checked } as Partial<Assignment>);
            setIsEditing(false);
          }}
          autoFocus
        />
      );
    }

    return (
      <input
        type="text"
        value={String(value || '')}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyPress}
        className="w-full p-1 border rounded text-sm"
        autoFocus
      />
    );
  };

  if (loading) {
    return <div className="loading">Opdrachten laden...</div>;
  }

  return (
    <div className="page-container">
      <div className="assignments-header">
        <h2>📝 Opdrachten beheer</h2>
        <div className="assignments-stats">
          <span className="stat">📊 {assignments.length} opdrachten</span>
          <span className="stat">✅ {assignments.filter(a => a.is_active).length} actief</span>
        </div>
      </div>

      {/* Filters en zoeken */}
      <div className="assignments-controls">
        <div className="search-filters">
          <input
            type="text"
            placeholder="Zoek opdrachten..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">Alle categorieën</option>
            <option value="general">General</option>
            <option value="social">Social</option>
            <option value="creative">Creative</option>
            <option value="physical">Physical</option>
            <option value="challenge">Challenge</option>
          </select>
          
          <select 
            value={filterDifficulty} 
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="filter-select"
          >
            <option value="all">Alle moeilijkheidsgraden</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="extreme">Extreme</option>
          </select>

          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="filter-select"
          >
            <option value="number">Sorteer op nummer</option>
            <option value="difficulty">Sorteer op moeilijkheid</option>
            <option value="category">Sorteer op categorie</option>
          </select>
        </div>

        <div className="assignments-info">
          <p><strong>{filteredAndSortedAssignments.length}</strong> van {assignments.length} opdrachten getoond</p>
        </div>
      </div>

      {/* Opdrachten grid */}
      <div className="assignments-grid">
        {filteredAndSortedAssignments.map((assignment) => (
          <div key={assignment.id} className={`assignment-card ${!assignment.is_active ? 'inactive' : ''}`}>
            <div className="assignment-header">
              <div className="assignment-number">
                <span className="number">#{assignment.number}</span>
                <button
                  onClick={() => toggleActive(assignment)}
                  className={`status-toggle ${assignment.is_active ? 'active' : 'inactive'}`}
                  title={assignment.is_active ? 'Deactiveren' : 'Activeren'}
                >
                  {assignment.is_active ? '✅' : '❌'}
                </button>
              </div>
              
              <div className="assignment-meta">
                <span className={`difficulty-badge ${getDifficultyColor(assignment.difficulty)}`}>
                  {getDifficultyEmoji(assignment.difficulty)} {assignment.difficulty}
                </span>
                <span className="category-badge">
                  {getCategoryIcon(assignment.category)} {assignment.category}
                </span>
                <span className={`points-badge ${getPointsColor(assignment.points_base)}`}>
                  {assignment.points_base} pt
                </span>
              </div>
            </div>

            <div className="assignment-content">
              <div className="assignment-title">
                <InlineEditor assignment={assignment} field="title" />
              </div>
              
              <div className="assignment-description">
                <InlineEditor assignment={assignment} field="description" type="textarea" />
              </div>

              <div className="assignment-details">
                <div className="detail-row">
                  <label>Categorie:</label>
                  <InlineEditor assignment={assignment} field="category" type="select" />
                </div>
                
                <div className="detail-row">
                  <label>Moeilijkheid:</label>
                  <InlineEditor assignment={assignment} field="difficulty" type="select" />
                </div>
                
                <div className="detail-row">
                  <label>Basispunten:</label>
                  <InlineEditor assignment={assignment} field="points_base" type="number" />
                </div>
                
                <div className="detail-row">
                  <label>Geschatte tijd:</label>
                  <InlineEditor assignment={assignment} field="estimated_time" type="number" /> min
                </div>
              </div>

              <div className="assignment-requirements">
                <h4>Vereisten:</h4>
                <div className="requirements-grid">
                  <label className="requirement-item">
                    <InlineEditor assignment={assignment} field="requires_photo" type="checkbox" />
                    📸 Foto vereist
                  </label>
                  <label className="requirement-item">
                    <InlineEditor assignment={assignment} field="requires_video" type="checkbox" />
                    🎥 Video vereist
                  </label>
                  <label className="requirement-item">
                    <InlineEditor assignment={assignment} field="requires_audio" type="checkbox" />
                    🎵 Audio vereist
                  </label>
                </div>
              </div>

              {assignment.special_instructions && (
                <div className="special-instructions">
                  <h4>Speciale instructies:</h4>
                  <InlineEditor assignment={assignment} field="special_instructions" type="textarea" />
                </div>
              )}
            </div>

            <div className="assignment-footer">
              <span className="last-updated">
                Laatst gewijzigd: {new Date(assignment.updated_at).toLocaleDateString('nl-NL')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredAndSortedAssignments.length === 0 && (
        <div className="no-assignments">
          <h3>Geen opdrachten gevonden</h3>
          <p>Probeer je zoekcriteria aan te passen.</p>
        </div>
      )}

      {/* Bulk acties */}
      <div className="bulk-actions">
        <h3>Bulk acties</h3>
        <div className="bulk-buttons">
          <button 
            onClick={() => {
              if (confirm('Weet je zeker dat je alle opdrachten wilt activeren?')) {
                assignments.forEach(assignment => {
                  if (!assignment.is_active) {
                    updateAssignment(assignment.id, { is_active: true });
                  }
                });
              }
            }}
            className="bulk-btn activate"
          >
            ✅ Alle activeren
          </button>
          
          <button 
            onClick={() => {
              if (confirm('Weet je zeker dat je alle opdrachten wilt deactiveren?')) {
                assignments.forEach(assignment => {
                  if (assignment.is_active) {
                    updateAssignment(assignment.id, { is_active: false });
                  }
                });
              }
            }}
            className="bulk-btn deactivate"
          >
            ❌ Alle deactiveren
          </button>

          <button 
            onClick={() => {
              const csvContent = assignments.map(a => 
                `${a.number},"${a.title}","${a.description}",${a.category},${a.difficulty},${a.points_base},${a.is_active}`
              ).join('\n');
              const blob = new Blob([`Nummer,Titel,Beschrijving,Categorie,Moeilijkheid,Punten,Actief\n${csvContent}`], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'crazy88-opdrachten.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="bulk-btn export"
          >
            📤 Exporteer CSV
          </button>
        </div>
      </div>

      {/* Statistieken */}
      <div className="assignments-statistics">
        <h3>📊 Statistieken</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Per categorie</h4>
            {['general', 'social', 'creative', 'physical', 'challenge'].map(category => {
              const count = assignments.filter(a => a.category === category).length;
              const percentage = ((count / assignments.length) * 100).toFixed(1);
              return (
                <div key={category} className="stat-row">
                  <span>{getCategoryIcon(category)} {category}</span>
                  <span>{count} ({percentage}%)</span>
                </div>
              );
            })}
          </div>

          <div className="stat-card">
            <h4>Per moeilijkheidsgraad</h4>
            {['easy', 'medium', 'hard', 'extreme'].map(difficulty => {
              const count = assignments.filter(a => a.difficulty === difficulty).length;
              const percentage = ((count / assignments.length) * 100).toFixed(1);
              return (
                <div key={difficulty} className="stat-row">
                  <span>{getDifficultyEmoji(difficulty)} {difficulty}</span>
                  <span>{count} ({percentage}%)</span>
                </div>
              );
            })}
          </div>

          <div className="stat-card">
            <h4>Media vereisten</h4>
            <div className="stat-row">
              <span>📸 Foto vereist</span>
              <span>{assignments.filter(a => a.requires_photo).length}</span>
            </div>
            <div className="stat-row">
              <span>🎥 Video vereist</span>
              <span>{assignments.filter(a => a.requires_video).length}</span>
            </div>
            <div className="stat-row">
              <span>🎵 Audio vereist</span>
              <span>{assignments.filter(a => a.requires_audio).length}</span>
            </div>
          </div>

          <div className="stat-card">
            <h4>Punt verdeling</h4>
            {[1, 2, 3].map(points => {
              const count = assignments.filter(a => a.points_base === points).length;
              const percentage = ((count / assignments.length) * 100).toFixed(1);
              return (
                <div key={points} className="stat-row">
                  <span className={getPointsColor(points)}>{points} punt{points !== 1 ? 'en' : ''}</span>
                  <span>{count} ({percentage}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentManagement;