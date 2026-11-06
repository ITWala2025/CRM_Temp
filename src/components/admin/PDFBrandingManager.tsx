import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, Check } from 'lucide-react';
import { PDFBrandingService, type PDFBrandingImages } from '../../services/pdfBrandingService';
import type { CompanySettings } from '../../types/invoice';

interface PDFBrandingManagerProps {
  companySettings: CompanySettings;
  onSettingsUpdate: (settings: CompanySettings) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function PDFBrandingManager({
  companySettings,
  onSettingsUpdate,
  onSuccess,
  onError
}: PDFBrandingManagerProps) {
  const [uploading, setUploading] = useState<{
    header: boolean;
    footer: boolean;
    logo: boolean;
  }>({
    header: false,
    footer: false,
    logo: false
  });

  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (
    file: File,
    imageType: 'header' | 'footer' | 'logo'
  ) => {
    setUploading(prev => ({ ...prev, [imageType]: true }));

    try {
      // Upload and optimize image
      const result = await PDFBrandingService.uploadBrandingImage(
        file,
        imageType,
        companySettings.id
      );

      if (result.error) {
        onError(result.error);
        return;
      }

      // Prepare branding images object
      const brandingImages: PDFBrandingImages = {
        [imageType + 'Image']: result
      };

      // Validate total size
      const sizeValidation = PDFBrandingService.validateTotalImageSize(brandingImages);
      if (!sizeValidation.valid && sizeValidation.error) {
        onError(sizeValidation.error);
        return;
      }

      // Update company settings
      const updateResult = await PDFBrandingService.updateCompanyBranding(
        companySettings.id,
        brandingImages
      );

      if (!updateResult.success) {
        onError(updateResult.error || 'Failed to update branding');
        return;
      }

      // Update local state
      const updatedSettings = {
        ...companySettings,
        [`${imageType}_image_url`]: result.url,
        [`${imageType}_image_data`]: result.data
      };

      onSettingsUpdate(updatedSettings);
      onSuccess(`${imageType.charAt(0).toUpperCase() + imageType.slice(1)} image uploaded successfully!`);

    } catch (error) {
      console.error('Upload error:', error);
      onError(`Failed to upload ${imageType} image`);
    } finally {
      setUploading(prev => ({ ...prev, [imageType]: false }));
    }
  };

  const handleRemoveImage = async (imageType: 'header' | 'footer' | 'logo') => {
    try {
      const result = await PDFBrandingService.removeBrandingImage(
        companySettings.id,
        imageType
      );

      if (!result.success) {
        onError(result.error || 'Failed to remove image');
        return;
      }

      // Update local state with null values to match database
      const updatedSettings = {
        ...companySettings,
        [`${imageType}_image_url`]: null,
        [`${imageType}_image_data`]: null
      };

      onSettingsUpdate(updatedSettings);
      onSuccess(`${imageType.charAt(0).toUpperCase() + imageType.slice(1)} image removed successfully!`);

    } catch (error) {
      console.error('Remove error:', error);
      onError(`Failed to remove ${imageType} image`);
    }
  };

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
    imageType: 'header' | 'footer' | 'logo'
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file, imageType);
    }
    // Reset input value to allow re-selecting the same file
    event.target.value = '';
  };

  const ImageUploadCard = ({ 
    type, 
    title, 
    description, 
    currentImageUrl,
    inputRef 
  }: {
    type: 'header' | 'footer' | 'logo';
    title: string;
    description: string;
    currentImageUrl?: string;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <div className="border border-slate-200 rounded-lg p-6 bg-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        {currentImageUrl && (
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
              <img 
                src={currentImageUrl} 
                alt={`${title} preview`}
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={() => handleRemoveImage(type)}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title={`Remove ${title.toLowerCase()}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={(e) => handleFileSelect(e, type)}
        className="hidden"
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading[type]}
        className="w-full border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex flex-col items-center gap-2">
          {uploading[type] ? (
            <>
              <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-600">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">
                {currentImageUrl ? 'Replace Image' : 'Upload Image'}
              </span>
              <span className="text-xs text-slate-500">
                JPEG, PNG, GIF, WebP up to 2MB
              </span>
            </>
          )}
        </div>
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900 mb-2">Image Guidelines</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Header: Recommended dimensions 1000x200px for letterhead</li>
              <li>• Footer: Recommended dimensions 1000x150px for contact info</li>
              <li>• Logo: Recommended dimensions 400x400px or smaller</li>
              <li>• All images will be automatically optimized for PDF inclusion</li>
              <li>• Total size of all images should not exceed 2MB</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Image Upload Cards */}
      <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-3">
        <ImageUploadCard
          type="header"
          title="Header Image"
          description="Appears at the top of every invoice page"
          currentImageUrl={companySettings.header_image_url}
          inputRef={headerInputRef}
        />
        
        <ImageUploadCard
          type="footer"
          title="Footer Image"
          description="Appears at the bottom of every invoice page"
          currentImageUrl={companySettings.footer_image_url}
          inputRef={footerInputRef}
        />
        
        <ImageUploadCard
          type="logo"
          title="Logo Image"
          description="Company logo for invoice branding"
          currentImageUrl={companySettings.logo_image_url}
          inputRef={logoInputRef}
        />
      </div>

      {/* Current Status */}
      {(companySettings.header_image_url || companySettings.footer_image_url || companySettings.logo_image_url) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-green-900 mb-2">PDF Branding Active</h4>
              <p className="text-sm text-green-800">
                Your PDF invoices will now include the uploaded branding images. Preview your changes by generating a test invoice.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
