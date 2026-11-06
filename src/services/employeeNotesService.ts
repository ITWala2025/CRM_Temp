import { supabase } from '../config/supabase';
import { auditLogService } from './auditLogService';
import type { EmployeeNote, CreateEmployeeNoteInput } from '../types/employee';

export const employeeNotesService = {
  async getNotes(employeeId: string): Promise<EmployeeNote[]> {
    const { data, error } = await supabase
      .from('employee_notes')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addNote(input: CreateEmployeeNoteInput): Promise<EmployeeNote> {
    const { data, error } = await supabase
      .from('employee_notes')
      .insert(input)
      .select()
      .single();
    if (error) throw error;

    await auditLogService.createLog({
      employee_id: input.employee_id,
      table_name: 'employee_notes',
      record_id: data.id,
      action: 'note_added',
      change_summary: `Note added by ${input.created_by_name}`,
      performed_by_name: input.created_by_name,
      new_value: input.note_text,
    });

    return data;
  },

  async deleteNote(noteId: string, employeeId: string, deletedByName: string): Promise<void> {
    const { data: note } = await supabase
      .from('employee_notes')
      .select('note_text')
      .eq('id', noteId)
      .single();

    const { error } = await supabase
      .from('employee_notes')
      .delete()
      .eq('id', noteId);
    if (error) throw error;

    await auditLogService.createLog({
      employee_id: employeeId,
      table_name: 'employee_notes',
      record_id: noteId,
      action: 'delete',
      change_summary: `Note deleted by ${deletedByName}`,
      performed_by_name: deletedByName,
      old_value: note?.note_text,
    });
  },
};
