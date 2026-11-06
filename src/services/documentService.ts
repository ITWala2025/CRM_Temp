/**
 * Employee Documents Service - Handles document uploads and management
 */

import { supabase } from '../config/supabase';
import type { EmployeeDocument, DocumentUploadFormData } from '../types/employee';

export const documentService = {
  /**
   * Upload employee document to Supabase Storage
   */
  async uploadDocument(
    employeeId: string,
    formData: DocumentUploadFormData & { file: File }
  ): Promise<EmployeeDocument | null> {
    try {
      const file = formData.file;
      const timestamp = Date.now();
      const fileName = `${employeeId}/${formData.document_type}/${timestamp}_${file.name}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('employee-documents')
        .getPublicUrl(fileName);

      // Create document record in database
      const { data, error } = await supabase
        .from('employment_documents')
        .insert({
          employee_id: employeeId,
          document_type: formData.document_type,
          document_name: formData.document_name,
          document_path: fileName,
          document_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          expiry_date: formData.expiry_date,
          verification_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error uploading document:', error);
      return null;
    }
  },

  /**
   * Get employee documents
   */
  async getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[] | null> {
    try {
      const { data, error } = await supabase
        .from('employment_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching documents:', error);
      return null;
    }
  },

  /**
   * Get documents by type
   */
  async getDocumentsByType(employeeId: string, documentType: string): Promise<EmployeeDocument[] | null> {
    try {
      const { data, error } = await supabase
        .from('employment_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('document_type', documentType)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching documents by type:', error);
      return null;
    }
  },

  /**
   * Get pending verification documents (Admin)
   */
  async getPendingDocuments(): Promise<EmployeeDocument[] | null> {
    try {
      const { data, error } = await supabase
        .from('employment_documents')
        .select('*, employees(id, first_name, last_name, email)')
        .eq('verified', false)
        .order('created_at');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching pending documents:', error);
      return null;
    }
  },

  /**
   * Verify document (Admin)
   */
  async verifyDocument(
    documentId: string,
    verifiedBy: string,
    verificationNotes?: string
  ): Promise<EmployeeDocument | null> {
    try {
      const { data, error } = await supabase
        .from('employment_documents')
        .update({
          verified: true,
          verified_by: verifiedBy,
          verified_at: new Date().toISOString(),
          verification_notes: verificationNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error verifying document:', error);
      return null;
    }
  },

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      // Get document to find file path
      const { data: document, error: fetchError } = await supabase
        .from('employment_documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage
      if (document?.file_path) {
        const { error: deleteError } = await supabase.storage
          .from('employee-documents')
          .remove([document.file_path]);

        if (deleteError) throw deleteError;
      }

      // Delete from database
      const { error } = await supabase
        .from('employment_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  },

  /**
   * Check document expiry
   */
  async getExpiringDocuments(employeeId: string, daysUntilExpiry = 30): Promise<EmployeeDocument[] | null> {
    try {
      const today = new Date();
      const expiryDate = new Date(today.getTime() + daysUntilExpiry * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('employment_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', expiryDate.toISOString().split('T')[0])
        .gte('expiry_date', today.toISOString().split('T')[0]);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching expiring documents:', error);
      return null;
    }
  },

  /**
   * Update document
   */
  async updateDocument(documentId: string, updates: Partial<EmployeeDocument>): Promise<EmployeeDocument | null> {
    try {
      const { data, error } = await supabase
        .from('employment_documents')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating document:', error);
      return null;
    }
  },

  /**
   * Check if employee has required documents
   */
  async checkRequiredDocuments(employeeId: string, requiredTypes: string[]): Promise<{ missing: string[], present: string[] }> {
    try {
      const documents = await this.getEmployeeDocuments(employeeId);
      if (!documents) return { missing: requiredTypes, present: [] };

      const presentTypes = documents.map(d => d.document_type);
      const missingTypes = requiredTypes.filter(t => !presentTypes.includes(t));
      const presentRequired = requiredTypes.filter(t => presentTypes.includes(t));

      return {
        missing: missingTypes,
        present: presentRequired,
      };
    } catch (error) {
      console.error('Error checking required documents:', error);
      return { missing: requiredTypes, present: [] };
    }
  },
};

export default documentService;

