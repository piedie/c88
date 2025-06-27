// src/utils/assignmentStatus.ts - Unified Status Manager

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
  
  // Get status for specific team and assignment
  static async getStatus(teamId: string, assignmentNumber: number, gameSessionId: string): Promise<AssignmentStatus | null> {
    const { data, error } = await supabase
      .from('assignment_status')
      .select('*')
      .eq('team_id', teamId)
      .eq('assignment_number', assignmentNumber)
      .eq('game_session_id', gameSessionId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching assignment status:', error);
      return null;
    }
    
    return data;
  }

  // Get all statuses for a team
  static async getTeamStatuses(teamId: string, gameSessionId: string): Promise<AssignmentStatus[]> {
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
  }

  // Update assignment status (SINGLE SOURCE OF TRUTH)
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

  // Complete assignment via jury (creativity/manual)
  static async completeViaJury(
    teamId: string, 
    assignmentNumber: number, 
    points: number,
    gameSessionId: string,
    method: 'jury' | 'creativity' = 'jury',
    notes?: string
  ): Promise<boolean> {
    try {
      // First insert into scores table (for existing jury system compatibility)
      const { data: scoreData, error: scoreError } = await supabase
        .from('scores')
        .insert([{
          team_id: teamId,
          assignment_id: assignmentNumber,
          points,
          game_session_id: gameSessionId,
          created_via: method
        }])
        .select()
        .single();

      if (scoreError) {
        console.error('Error creating score:', scoreError);
        return false;
      }

      // Then update unified status
      return await this.updateStatus(
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
    } catch (error) {
      console.error('Exception in completeViaJury:', error);
      return false;
    }
  }

  // Complete assignment via review approval
  static async completeViaReview(
    submissionId: string,
    teamId: string,
    assignmentNumber: number,
    points: number,
    gameSessionId: string,
    notes?: string
  ): Promise<boolean> {
    try {
      // First create score for jury system compatibility
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
      }

      // Update unified status
      return await this.updateStatus(
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
    } catch (error) {
      console.error('Exception in completeViaReview:', error);
      return false;
    }
  }

  // Submit assignment (team uploads)
  static async submitAssignment(
    submissionId: string,
    teamId: string,
    assignmentNumber: number,
    gameSessionId: string
  ): Promise<boolean> {
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
  }

  // Reject assignment
  static async rejectAssignment(
    submissionId: string,
    teamId: string,
    assignmentNumber: number,
    gameSessionId: string,
    notes?: string
  ): Promise<boolean> {
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
  }

  // Check if assignment is completed (any method)
  static async isCompleted(teamId: string, assignmentNumber: number, gameSessionId: string): Promise<boolean> {
    const status = await this.getStatus(teamId, assignmentNumber, gameSessionId);
    return status?.status === 'approved' || status?.status === 'completed_jury';
  }

  // Get team progress summary
  static async getTeamProgress(teamId: string, gameSessionId: string): Promise<{
    total_assignments: number;
    completed: number;
    submitted: number;
    rejected: number;
    total_points: number;
  }> {
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
  }

  // Get completed assignment numbers for a team (for UI graying out)
  static async getCompletedAssignmentNumbers(teamId: string, gameSessionId: string): Promise<number[]> {
    const statuses = await this.getTeamStatuses(teamId, gameSessionId);
    return statuses
      .filter(s => s.status === 'approved' || s.status === 'completed_jury')
      .map(s => s.assignment_number);
  }

  // Reset game session (admin function)
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