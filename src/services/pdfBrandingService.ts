import { supabase } from '../config/supabase';
import type { CompanySettings } from '../types/invoice';

// Maximum file size for images (2MB)
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Allowed image types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

export interface ImageUploadResult {
  url?: string;
  data?: string;
  error?: string;
}

export interface PDFBrandingImages {
  headerImage?: ImageUploadResult;
  footerImage?: ImageUploadResult;
  logoImage?: ImageUploadResult;
}

/**
 * Service for managing PDF branding images including upload, optimization, and storage
 */
export class PDFBrandingService {
  
  /**
   * Validate image file before processing
   */
  private static validateImageFile(file: File): string | null {
    // Check file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`;
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
    }
    
    return null;
  }

  /**
   * Compress and optimize image to reduce size while maintaining quality
   */
  private static async optimizeImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, newWidth, newHeight);
        
        // Convert to base64 with compression
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Upload image file and return both URL and base64 data
   */
  static async uploadBrandingImage(
    file: File, 
    imageType: 'header' | 'footer' | 'logo',
    companyId: string
  ): Promise<ImageUploadResult> {
    try {
      // Validate file
      const validationError = this.validateImageFile(file);
      if (validationError) {
        return { error: validationError };
      }

      // Optimize image based on type
      let maxWidth = 1200;
      let quality = 0.8;
      
      switch (imageType) {
        case 'header':
          maxWidth = 1000;
          quality = 0.85;
          break;
        case 'footer':
          maxWidth = 1000;
          quality = 0.85;
          break;
        case 'logo':
          maxWidth = 400;
          quality = 0.9;
          break;
      }

      // Optimize image
      const optimizedDataUrl = await this.optimizeImage(file, maxWidth, quality);
      
      // Generate unique filename
      const timestamp = Date.now();
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `${companyId}/${imageType}-${timestamp}.${extension}`;

      // Upload to Supabase Storage
      const { data: _uploadData, error: uploadError } = await supabase.storage
        .from('company-branding')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return { error: `Upload failed: ${uploadError.message}` };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('company-branding')
        .getPublicUrl(fileName);

      return {
        url: urlData.publicUrl,
        data: optimizedDataUrl
      };

    } catch (error) {
      console.error('Image upload error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown upload error' 
      };
    }
  }

  /**
   * Update company settings with new branding images
   */
  static async updateCompanyBranding(
    companyId: string,
    brandingImages: PDFBrandingImages
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Partial<CompanySettings> = {};

      // Process header image
      if (brandingImages.headerImage?.url && brandingImages.headerImage?.data) {
        updateData.header_image_url = brandingImages.headerImage.url;
        updateData.header_image_data = brandingImages.headerImage.data;
      }

      // Process footer image
      if (brandingImages.footerImage?.url && brandingImages.footerImage?.data) {
        updateData.footer_image_url = brandingImages.footerImage.url;
        updateData.footer_image_data = brandingImages.footerImage.data;
      }

      // Process logo image
      if (brandingImages.logoImage?.url && brandingImages.logoImage?.data) {
        updateData.logo_image_url = brandingImages.logoImage.url;
        updateData.logo_image_data = brandingImages.logoImage.data;
      }

      // Update company settings
      const { error } = await supabase
        .from('company_settings')
        .update(updateData)
        .eq('id', companyId);

      if (error) {
        console.error('Database update error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      console.error('Update branding error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown update error' 
      };
    }
  }

  /**
   * Remove branding image from company settings
   */
  static async removeBrandingImage(
    companyId: string,
    imageType: 'header' | 'footer' | 'logo'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current settings to check if there's a Supabase storage URL to delete
      const { data: currentSettings } = await supabase
        .from('company_settings')
        .select('header_image_url, footer_image_url, logo_image_url')
        .eq('id', companyId)
        .single();

      let storageUrlToDelete: string | null = null;

      // Determine which storage URL to delete (if any)
      if (currentSettings) {
        switch (imageType) {
          case 'header':
            storageUrlToDelete = currentSettings.header_image_url;
            break;
          case 'footer':
            storageUrlToDelete = currentSettings.footer_image_url;
            break;
          case 'logo':
            storageUrlToDelete = currentSettings.logo_image_url;
            break;
        }
      }

      // Delete from Supabase storage if it's a storage URL
      if (storageUrlToDelete && storageUrlToDelete.includes('supabase.co/storage/')) {
        try {
          // Extract file path from the storage URL
          const urlParts = storageUrlToDelete.split('/');
          const bucketIndex = urlParts.findIndex(part => part === 'company-branding');
          if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
            const filePath = urlParts.slice(bucketIndex + 1).join('/');
            
            const { error: deleteError } = await supabase.storage
              .from('company-branding')
              .remove([filePath]);

            if (deleteError) {
              console.warn('Failed to delete file from storage:', deleteError.message);
              // Continue with database update even if storage deletion fails
            }
          }
        } catch (storageError) {
          console.warn('Storage deletion error:', storageError);
          // Continue with database update even if storage deletion fails
        }
      }

      // Prepare update data with explicit null values
      const updateData: Record<string, null> = {};

      switch (imageType) {
        case 'header':
          updateData.header_image_url = null;
          updateData.header_image_data = null;
          break;
        case 'footer':
          updateData.footer_image_url = null;
          updateData.footer_image_data = null;
          break;
        case 'logo':
          updateData.logo_image_url = null;
          updateData.logo_image_data = null;
          break;
      }

      const { error } = await supabase
        .from('company_settings')
        .update(updateData)
        .eq('id', companyId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get current branding images for a company
   */
  static async getCompanyBrandingImages(companyId: string): Promise<{
    headerImage?: string;
    footerImage?: string;
    logoImage?: string;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('header_image_url, footer_image_url, logo_image_url')
        .eq('id', companyId)
        .single();

      if (error) {
        return { error: error.message };
      }

      return {
        headerImage: data.header_image_url || undefined,
        footerImage: data.footer_image_url || undefined,
        logoImage: data.logo_image_url || undefined
      };

    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Calculate total size of images to ensure PDF stays under 2MB
   */
  static calculateImageSizes(images: PDFBrandingImages): number {
    let totalSize = 0;
    
    if (images.headerImage?.data) {
      totalSize += this.getBase64Size(images.headerImage.data);
    }
    
    if (images.footerImage?.data) {
      totalSize += this.getBase64Size(images.footerImage.data);
    }
    
    if (images.logoImage?.data) {
      totalSize += this.getBase64Size(images.logoImage.data);
    }
    
    return totalSize;
  }

  /**
   * Get size of base64 encoded string in bytes
   */
  private static getBase64Size(base64String: string): number {
    // Remove data URL prefix if present
    const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Calculate size (base64 encoding adds ~33% overhead)
    return Math.ceil((base64Data.length * 3) / 4);
  }

  /**
   * Validate that total image size won't exceed PDF limit
   */
  static validateTotalImageSize(images: PDFBrandingImages): { 
    valid: boolean; 
    totalSize: number; 
    maxSize: number;
    error?: string;
  } {
    const totalSize = this.calculateImageSizes(images);
    const maxSize = MAX_FILE_SIZE;
    
    if (totalSize > maxSize) {
      return {
        valid: false,
        totalSize,
        maxSize,
        error: `Total image size (${Math.round(totalSize / 1024)}KB) exceeds maximum (${Math.round(maxSize / 1024)}KB). Please use smaller images or reduce quality.`
      };
    }
    
    return {
      valid: true,
      totalSize,
      maxSize
    };
  }
}

export default PDFBrandingService;
