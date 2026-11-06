import { supabase, isSupabaseConfigured } from '../config/supabase';
import { ITSMAttachment } from '../types/itsm';

export class ITSMAttachmentService {
  private static readonly BUCKET_NAME = 'itsm-attachments';

  /**
   * Upload an attachment file to Supabase storage or return mock fallback path
   */
  static async uploadAttachment(
    ticketId: string,
    file: File,
    commentId?: string,
    uploadedByUserId?: string
  ): Promise<ITSMAttachment> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const storagePath = `${ticketId}/${fileName}`;

    let publicUrl = '';
    let scanStatus: 'clean' | 'pending' | 'quarantined' = 'clean';

    if (isSupabaseConfigured) {
      try {
        const { error: uploadError } = await supabase.storage
          .from(this.BUCKET_NAME)
          .upload(storagePath, file, { cacheControl: '3600', upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from(this.BUCKET_NAME)
            .getPublicUrl(storagePath);
          publicUrl = urlData?.publicUrl || '';
        } else {
          console.warn('Supabase storage upload failed, using fallback URL:', uploadError);
        }
      } catch (err) {
        console.warn('Attachment upload error:', err);
      }
    }

    const attachmentPayload = {
      ticket_id: ticketId,
      comment_id: commentId || null,
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      scan_status: scanStatus,
      uploaded_by: uploadedByUserId || null,
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('itsm_attachments')
          .insert([attachmentPayload])
          .select()
          .single();

        if (!error && data) {
          return {
            ...data,
            public_url: publicUrl,
          } as ITSMAttachment;
        }
      } catch (err) {
        console.warn('DB insert for attachment failed:', err);
      }
    }

    return {
      id: `att-${Date.now()}`,
      ticket_id: ticketId,
      comment_id: commentId || null,
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      scan_status: 'clean',
      uploaded_by: uploadedByUserId || null,
      created_at: new Date().toISOString(),
      public_url: publicUrl,
    };
  }

  /**
   * Fetch all attachments for a ticket
   */
  static async getAttachmentsForTicket(ticketId: string): Promise<ITSMAttachment[]> {
    if (!isSupabaseConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('itsm_attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((att) => {
        const { data: urlData } = supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(att.storage_path);
        return {
          ...att,
          public_url: urlData?.publicUrl || '',
        };
      });
    } catch (err) {
      console.error('getAttachmentsForTicket error:', err);
      return [];
    }
  }
}

export default ITSMAttachmentService;
