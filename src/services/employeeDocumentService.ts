import { supabase } from '../config/supabase';
import type { EmployeeDocument } from '../types/employee';

export interface UploadDocumentInput {
  employee_id: string;
  document_type: string;
  document_name: string;
  document_description?: string;
  file: File;
  expiry_date?: string;
  uploaded_by?: string;
}

export interface UpdateDocumentInput {
  id: string;
  document_type?: string;
  document_name?: string;
  document_description?: string;
  expiry_date?: string;
  file?: File;
  updated_by?: string;
}

export interface DocumentFilter {
  employee_id?: string;
  document_type?: string;
  verification_status?: string;
  uploaded_by?: string;
}

const STORAGE_BUCKET = 'employee-documents';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/x-pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

const isAllowedFile = (file: File): boolean => {
  if (ALLOWED_MIME_TYPES.includes(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext || '');
};

const isValidUUID = (str?: string): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

export const employeeDocumentService = {
  /**
   * Upload a document to Supabase storage and create database record
   */
  async uploadDocument(input: UploadDocumentInput): Promise<EmployeeDocument> {
    try {
      // Validate file size
      if (input.file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds 5MB limit. File size: ${(input.file.size / 1024 / 1024).toFixed(2)}MB`);
      }

      // Validate MIME type & file extension (allowing PDF, JPEG, PNG, WEBP)
      if (!isAllowedFile(input.file)) {
        throw new Error(`File type not allowed. Allowed formats: PDF, JPEG, JPG, PNG, WEBP`);
      }

      // Generate unique file path: employee_id/timestamp_filename
      const timestamp = Date.now();
      const sanitizedFileName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${input.employee_id}/${timestamp}_${sanitizedFileName}`;

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, input.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
      }

      // Sanitize uploaded_by UUID for database foreign key safety
      const rawUploadedBy = input.uploaded_by || input.employee_id;
      const uploadedBy = isValidUUID(rawUploadedBy)
        ? rawUploadedBy
        : (isValidUUID(input.employee_id) ? input.employee_id : null);

      // Create database record
      const documentData: Partial<EmployeeDocument> = {
        employee_id: input.employee_id,
        document_type: input.document_type,
        document_name: input.document_name,
        document_description: input.document_description,
        file_name: input.file.name,
        file_size: input.file.size,
        mime_type: input.file.type || 'application/octet-stream',
        storage_bucket: STORAGE_BUCKET,
        storage_path: uploadData.path,
        expiry_date: input.expiry_date || undefined,
        uploaded_by: uploadedBy || input.employee_id,
        verification_status: 'pending',
        is_active: true
      };

      const { data, error } = await supabase
        .from('employee_documents')
        .insert([documentData])
        .select()
        .single();

      if (error) {
        // If database insert fails, try to delete the uploaded file
        await supabase.storage.from(STORAGE_BUCKET).remove([uploadData.path]);
        throw new Error(`Failed to create document record: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Upload document error:', error);
      throw error;
    }
  },

  /**
   * Replace an existing document with a new file
   */
  async replaceDocument(id: string, newFile: File, _updatedBy?: string): Promise<EmployeeDocument> {
    try {
      const document = await this.getDocumentById(id);
      if (!document) {
        throw new Error('Document not found');
      }

      if (newFile.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds 5MB limit. File size: ${(newFile.size / 1024 / 1024).toFixed(2)}MB`);
      }

      if (!isAllowedFile(newFile)) {
        throw new Error(`File type not allowed. Allowed formats: PDF, JPEG, JPG, PNG, WEBP`);
      }

      const oldPath = document.storage_path;
      const timestamp = Date.now();
      const sanitizedFileName = newFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const newPath = `${document.employee_id}/${timestamp}_${sanitizedFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(newPath, newFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload replacement file: ${uploadError.message}`);
      }

      const { data, error: updateError } = await supabase
        .from('employee_documents')
        .update({
          file_name: newFile.name,
          file_size: newFile.size,
          mime_type: newFile.type,
          storage_path: uploadData.path,
          verification_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([uploadData.path]);
        throw new Error(`Failed to update document record: ${updateError.message}`);
      }

      if (oldPath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([oldPath]);
      }

      return data;
    } catch (error) {
      console.error('Replace document error:', error);
      throw error;
    }
  },

  /**
   * Update all document metadata (document_type, document_name, document_description, expiry_date, and optional file)
   */
  async updateDocument(input: UpdateDocumentInput): Promise<EmployeeDocument> {
    try {
      const document = await this.getDocumentById(input.id);
      if (!document) {
        throw new Error('Document not found');
      }

      const updates: Partial<EmployeeDocument> = {
        updated_at: new Date().toISOString()
      };

      if (input.document_type) updates.document_type = input.document_type;
      if (input.document_name) updates.document_name = input.document_name;
      if (input.document_description !== undefined) updates.document_description = input.document_description;
      if (input.expiry_date !== undefined) updates.expiry_date = input.expiry_date || undefined;

      // Handle optional file replacement
      if (input.file) {
        if (input.file.size > MAX_FILE_SIZE) {
          throw new Error(`File size exceeds 5MB limit. File size: ${(input.file.size / 1024 / 1024).toFixed(2)}MB`);
        }
        if (!isAllowedFile(input.file)) {
          throw new Error(`File type not allowed. Allowed formats: PDF, JPEG, JPG, PNG, WEBP`);
        }

        const oldPath = document.storage_path;
        const timestamp = Date.now();
        const sanitizedFileName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const newPath = `${document.employee_id}/${timestamp}_${sanitizedFileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(newPath, input.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Failed to upload replacement file: ${uploadError.message}`);
        }

        updates.file_name = input.file.name;
        updates.file_size = input.file.size;
        updates.mime_type = input.file.type || 'application/octet-stream';
        updates.storage_path = uploadData.path;

        if (oldPath) {
          await supabase.storage.from(STORAGE_BUCKET).remove([oldPath]);
        }
      }

      const { data, error: updateError } = await supabase
        .from('employee_documents')
        .update(updates)
        .eq('id', input.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update document record: ${updateError.message}`);
      }

      return data;
    } catch (error) {
      console.error('Update document error:', error);
      throw error;
    }
  },

  /**
   * Delete a document (only if pending verification, or force=true for admin)
   */
  async deleteDocument(id: string, force: boolean = false): Promise<void> {
    try {
      // Get document details
      const document = await this.getDocumentById(id);
      if (!document) {
        throw new Error('Document not found');
      }

      // Allow deletion of pending/rejected documents, or forced deletion by admin
      if (!force && document.verification_status === 'verified') {
        throw new Error('Cannot delete verified documents');
      }

      // Delete from storage if storage path exists
      if (document.storage_path) {
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([document.storage_path]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
        }
      }

      // Hard delete from database
      const { error } = await supabase
        .from('employee_documents')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete document: ${error.message}`);
      }
    } catch (error) {
      console.error('Delete document error:', error);
      throw error;
    }
  },
  async getDocuments(filter?: DocumentFilter): Promise<EmployeeDocument[]> {
    try {
      let query = supabase
        .from('employee_documents')
        .select('*')
        .eq('is_active', true);

      if (filter?.employee_id) {
        query = query.eq('employee_id', filter.employee_id);
      }

      if (filter?.document_type) {
        query = query.eq('document_type', filter.document_type);
      }

      if (filter?.verification_status) {
        query = query.eq('verification_status', filter.verification_status);
      }

      if (filter?.uploaded_by) {
        query = query.eq('uploaded_by', filter.uploaded_by);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch documents: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Get documents error:', error);
      throw error;
    }
  },

  /**
   * Get a single document by ID
   */
  async getDocumentById(id: string): Promise<EmployeeDocument | null> {
    try {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to fetch document: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Get document by ID error:', error);
      throw error;
    }
  },

  /**
   * Download a document file
   */
  async downloadDocument(storagePath: string): Promise<Blob> {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(storagePath);

      if (error) {
        throw new Error(`Failed to download document: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Download document error:', error);
      throw error;
    }
  },

  /**
   * Get signed URL for document preview/download
   */
  async getDocumentUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn);

      if (error) {
        throw new Error(`Failed to get document URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Get document URL error:', error);
      throw error;
    }
  },

  /**
   * Update document verification status (admin only)
   */
  async updateVerificationStatus(
    id: string,
    status: 'verified' | 'rejected' | 'pending' | 'expired',
    verifiedBy?: string,
    comments?: string
  ): Promise<EmployeeDocument> {
    try {
      const sanitizedVerifiedBy = isValidUUID(verifiedBy) ? verifiedBy : null;
      const { data, error } = await supabase
        .from('employee_documents')
        .update({
          verification_status: status,
          verified_by: sanitizedVerifiedBy,
          verification_date: new Date().toISOString(),
          verification_comments: comments || null
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update verification status: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Update verification status error:', error);
      throw error;
    }
  },

  /**
   * Get admin-generated documents for an employee
   */
  async getAdminGeneratedDocuments(employeeId: string) {
    try {
      const { data, error } = await supabase
        .from('employment_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch admin-generated documents: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Get admin-generated documents error:', error);
      throw error;
    }
  },

  /**
   * Get document statistics for an employee
   */
  async getDocumentStats(employeeId: string) {
    try {
      const documents = await this.getDocuments({ employee_id: employeeId });

      return {
        total: documents.length,
        pending: documents.filter(d => d.verification_status === 'pending').length,
        verified: documents.filter(d => d.verification_status === 'verified').length,
        rejected: documents.filter(d => d.verification_status === 'rejected').length,
        expired: documents.filter(d => d.verification_status === 'expired').length
      };
    } catch (error) {
      console.error('Get document stats error:', error);
      return {
        total: 0,
        pending: 0,
        verified: 0,
        rejected: 0,
        expired: 0
      };
    }
  }
};

export default employeeDocumentService;
