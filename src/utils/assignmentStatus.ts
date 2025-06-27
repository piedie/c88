// src/utils/assignmentStatus.ts - Fixed Version zonder errors

import { supabase } from '../lib/supabaseClient';

export interface AssignmentStatus {
  id: string;
  team_id: string;
  assignment_number: number;
  status: 'not_started' | 'submitted' | 'approved' | 'completed_jury' | 'rejected';
  points_awarded: number;
  completion_method?: 'jury' | 'review' | 'creativity';
  submission_id?: string;
  score_id?: string;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
  game_session_id: string;
  created_at: string;
  updated_at: string;
}

export class AssignmentStatusManager {
  
  // Get status for specific team and assignment - FIXED version
  static async getStatus(teamId: string, assignmentNumber: number, gameSessionId: string): Promise<AssignmentStatus | null> {
    try {
      const { data, error } = await supabase
        .from('assignment_status')
        .select('*')
        .eq('team_id', teamId)
        .eq('assignment_number', assignmentNumber)
        .eq('game_session_id', gameSessionId)
        .maybeSingle(); // Deze methode geeft geen error als er niks gevonden wordt
      
      if (error) {
        console.error('Error fetching assignment status:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Exception fetching assignment status:', error);
      return null;
    }
  }

  // Get all statuses for a team - FIXED version
  static async getTeamStatuses(teamId: string, gameSessionId: string): Promise<AssignmentStatus[]> {
    try {
      const { data, error } = await supabase
        .from('assignment_status')
        .select('*')
        .eq('team_id', teamId)
        .eq('game_session_id', gameSessionId)
        .order('assignment_number');
      
      if (error) {
        console.error('Error fetching team statuses:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception fetching team statuses:', error);
      return [];
    }
  }

  // Update assignment status - FIXED version
  static async updateStatus(
    teamId: string, 
    assignmentNumber: number, 
    status: AssignmentStatus['status'],
    points: number,
    method: AssignmentStatus['completion_method'],
    gameSessionId: string,
    options: {
      submissionId?: string;
      scoreId?: string;
      notes?: string;
      completedBy?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const statusData = {
        team_id: teamId,
        assignment_number: assignmentNumber,
        status,
        points_awarded: points,
        completion_method: method,
        game_session_id: gameSessionId,
        submission_id: options.submissionId,
        score_id: options.scoreId,
        notes: options.notes,
        completed_by: options.completedBy || 'system',
        completed_at: status === 'approved' || status === 'completed_jury' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('assignment_status')
        .upsert(statusData, {
          onConflict: 'team_id,assignment_number,game_session_id'
        });

      if (error) {
        console.error('Error updating assignment status:', error);
        return false;
      }

      console.log(`✅ Assignment status updated: Team ${teamId}, Assignment ${assignmentNumber}, Status: ${status}`);
      return true;
    } catch (error) {
      console.error('Exception updating assignment status:', error);
      return false;
    }
  }

// VERVANG de completeViaJury functie:
static async completeViaJury(
  teamId: string, 
  assignmentNumber: number, 
  points: number,
  gameSessionId: string,
  method: 'jury' | 'creativity' = 'jury',
  notes?: string
): Promise<boolean> {
  try {
    console.log(`🎯 CompleteViaJury: ${teamId}, assignment ${assignmentNumber}, ${points} points`);
    
    // UPSERT into scores table (gebruik upsert i.p.v. insert)
    const { data: scoreData, error: scoreError } = await supabase
      .from('scores')
      .upsert({
        team_id: teamId,
        assignment_id: assignmentNumber,
        points,
        game_session_id: gameSessionId,
        created_via: method
      }, {
        onConflict: 'team_id,assignment_id,game_session_id'
      })
      .select()
      .single();

    if (scoreError) {
      console.error('Error creating/updating score:', scoreError);
      return false;
    }

    console.log('✅ Score upserted successfully:', scoreData);

    // Then update unified status
    const statusSuccess = await this.updateStatus(
      teamId,
      assignmentNumber,
      'completed_jury',
      points,
      method,
      gameSessionId,
      {
        scoreId: scoreData.id,
        notes,
        completedBy: 'jury'
      }
    );

    return statusSuccess;
  } catch (error) {
    console.error('Exception in completeViaJury:', error);
    return false;
  }
}


 // VERVANG de completeViaReview functie:
static async completeViaReview(
  submissionId: string,
  teamId: string,
  assignmentNumber: number,
  points: number,
  gameSessionId: string,
  notes?: string
): Promise<boolean> {
  try {
    console.log(`📊 CompleteViaReview: ${teamId}, assignment ${assignmentNumber}, ${points} points`);
    
    // UPSERT score for jury system compatibility
    const { data: scoreData, error: scoreError } = await supabase
      .from('scores')
      .upsert({
        team_id: teamId,
        assignment_id: assignmentNumber,
        points,
        game_session_id: gameSessionId,
        created_via: 'review'
      }, {
        onConflict: 'team_id,assignment_id,game_session_id'
      })
      .select()
      .single();

    if (scoreError) {
      console.error('Error creating/updating score:', scoreError);
      // Continue anyway, status update is more important
    } else {
      console.log('✅ Score upserted successfully:', scoreData);
    }

    // Update unified status
    const statusSuccess = await this.updateStatus(
      teamId,
      assignmentNumber,
      'approved',
      points,
      'review',
      gameSessionId,
      {
        submissionId,
        scoreId: scoreData?.id,
        notes,
        completedBy: 'review'
      }
    );

    return statusSuccess;
  } catch (error) {
    console.error('Exception in completeViaReview:', error);
    return false;
  }
}

  // Submit assignment - FIXED version
  static async submitAssignment(
    submissionId: string,
    teamId: string,
    assignmentNumber: number,
    gameSessionId: string
  ): Promise<boolean> {
    try {
      return await this.updateStatus(
        teamId,
        assignmentNumber,
        'submitted',
        0,
        'review',
        gameSessionId,
        {
          submissionId,
          completedBy: 'team'
        }
      );
    } catch (error) {
      console.error('Exception in submitAssignment:', error);
      return false;
    }
  }

  // Reject assignment - FIXED version
  static async rejectAssignment(
    submissionId: string,
    teamId: string,
    assignmentNumber: number,
    gameSessionId: string,
    notes?: string
  ): Promise<boolean> {
    try {
      // Remove score if it exists
      await supabase
        .from('scores')
        .delete()
        .eq('team_id', teamId)
        .eq('assignment_id', assignmentNumber)
        .eq('game_session_id', gameSessionId);

      return await this.updateStatus(
        teamId,
        assignmentNumber,
        'rejected',
        0,
        'review',
        gameSessionId,
        {
          submissionId,
          notes,
          completedBy: 'review'
        }
      );
    } catch (error) {
      console.error('Exception in rejectAssignment:', error);
      return false;
    }
  }

  // Check if assignment is completed - FIXED version
  static async isCompleted(teamId: string, assignmentNumber: number, gameSessionId: string): Promise<boolean> {
    try {
      const status = await this.getStatus(teamId, assignmentNumber, gameSessionId);
      return status?.status === 'approved' || status?.status === 'completed_jury';
    } catch (error) {
      console.error('Exception checking completion status:', error);
      return false;
    }
  }

  // Get team progress summary - FIXED version
  static async getTeamProgress(teamId: string, gameSessionId: string): Promise<{
    total_assignments: number;
    completed: number;
    submitted: number;
    rejected: number;
    total_points: number;
  }> {
    try {
      const statuses = await this.getTeamStatuses(teamId, gameSessionId);
      
      const completed = statuses.filter(s => s.status === 'approved' || s.status === 'completed_jury').length;
      const submitted = statuses.filter(s => s.status === 'submitted').length;
      const rejected = statuses.filter(s => s.status === 'rejected').length;
      const total_points = statuses
        .filter(s => s.status === 'approved' || s.status === 'completed_jury')
        .reduce((sum, s) => sum + s.points_awarded, 0);

      return {
        total_assignments: 88, // Fixed total
        completed,
        submitted,
        rejected,
        total_points
      };
    } catch (error) {
      console.error('Exception getting team progress:', error);
      return {
        total_assignments: 88,
        completed: 0,
        submitted: 0,
        rejected: 0,
        total_points: 0
      };
    }
  }

  // Get completed assignment numbers - FIXED version
  static async getCompletedAssignmentNumbers(teamId: string, gameSessionId: string): Promise<number[]> {
    try {
      const statuses = await this.getTeamStatuses(teamId, gameSessionId);
      return statuses
        .filter(s => s.status === 'approved' || s.status === 'completed_jury')
        .map(s => s.assignment_number);
    } catch (error) {
      console.error('Exception getting completed assignments:', error);
      return [];
    }
  }

  // Reset game session - FIXED version
  static async resetGameSession(oldSessionId: string, newSessionId: string, keepTeams: boolean = true): Promise<boolean> {
    try {
      if (keepTeams) {
        // Update teams to new session
        await supabase
          .from('teams')
          .update({ game_session_id: newSessionId })
          .eq('game_session_id', oldSessionId);
      }

      // Clear assignment statuses for old session
      await supabase
        .from('assignment_status')
        .delete()
        .eq('game_session_id', oldSessionId);

      // Clear other session data
      await supabase
        .from('scores')
        .delete()
        .eq('game_session_id', oldSessionId);

      await supabase
        .from('submissions')
        .delete()
        .eq('game_session_id', oldSessionId);

      return true;
    } catch (error) {
      console.error('Error resetting game session:', error);
      return false;
    }
  }
}