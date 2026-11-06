import jsPDF from 'jspdf';
import { PDFBrandingUtils, PDFDimensions } from './pdfBrandingUtils';
import type { Policy } from '../types/policy';
import type { CompanySettings } from '../types/invoice';

/**
 * Utility class for generating formal Policy and SOP PDFs with Entity Header & Footer Branding
 */
export class PolicyPDFGenerator {
  private pdf: jsPDF;
  private dimensions: PDFDimensions;
  private policy: Policy;
  private company: CompanySettings;
  private currentY: number = 0;
  private pageNumber: number = 1;
  private contentStartY: number = 20;
  private contentEndY: number = 270;

  constructor(policy: Policy, company: CompanySettings) {
    this.policy = policy;
    this.company = company;

    this.pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    });

    this.dimensions = PDFBrandingUtils.getStandardDimensions();
    this.dimensions.leftMargin = 15;
    this.dimensions.rightMargin = 195;
    this.dimensions.topMargin = 15;
    this.dimensions.bottomMargin = 15;

    this.currentY = this.dimensions.topMargin;
    this.contentStartY = this.dimensions.topMargin;
    this.contentEndY = this.pdf.internal.pageSize.getHeight() - this.dimensions.bottomMargin;
  }

  /**
   * Main entry point to generate the PDF
   */
  async generate(): Promise<jsPDF> {
    // 1. Apply entity header & footer branding
    await this.applyPageBranding();

    // 2. Add Policy Main Document Header
    this.addDocumentHeader();

    // 3. Add Document Metadata Summary Table
    this.addMetadataCard();

    // 4. Add Policy Summary if present
    if (this.policy.summary && this.policy.summary.trim()) {
      await this.addSummarySection();
    }

    // 5. Add Structured Sections
    if (this.policy.sections && this.policy.sections.length > 0) {
      for (const section of this.policy.sections) {
        await this.addPolicySection(section);
      }
    }

    // 6. Add Sign-off / Enforcement Footer Box
    await this.addEnforcementSignOff();

    // 7. Add page numbers and final footer text to all pages
    this.finalizeDocument();

    return this.pdf;
  }

  /**
   * Apply entity header/footer image or default styled banners
   */
  private async applyPageBranding(): Promise<void> {
    const { contentStartY, contentEndY } = await PDFBrandingUtils.applyBranding(
      this.pdf,
      this.company,
      this.dimensions
    );

    this.contentStartY = contentStartY;
    this.contentEndY = contentEndY;
    this.currentY = this.contentStartY;
  }

  /**
   * Check page overflow and trigger page break
   */
  private async checkPageBreak(spaceNeeded: number): Promise<void> {
    if (this.currentY + spaceNeeded > this.contentEndY) {
      this.pdf.addPage();
      this.pageNumber++;
      await this.applyPageBranding();
    }
  }

  /**
   * Add Policy Document Header
   */
  private addDocumentHeader(): void {
    const { leftMargin, rightMargin } = this.dimensions;
    const pageWidth = this.pdf.internal.pageSize.getWidth();

    // If company doesn't have custom header image, draw styled corporate top bar
    if (!this.company.header_image_data) {
      this.pdf.setFillColor(30, 58, 138); // Deep primary Navy Blue (#1e3a8a)
      this.pdf.rect(0, 0, pageWidth, 24, 'F');

      this.pdf.setFontSize(14);
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text((this.company.company_name || 'KDADKS').toUpperCase(), leftMargin, 13);

      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text('CORPORATE GOVERNANCE & POLICY DOCUMENT', rightMargin, 13, { align: 'right' });

      this.currentY = 30;
    } else {
      this.currentY += 4;
    }

    // Document Category Badge & Code
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(37, 99, 235); // Blue #2563eb
    const catText = `${this.policy.category.toUpperCase()} • CODE: ${this.policy.policy_code}`;
    this.pdf.text(catText, leftMargin, this.currentY);
    this.currentY += 6;

    // Document Title
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(17, 24, 39); // Gray 900

    const titleLines = this.pdf.splitTextToSize(this.policy.title, rightMargin - leftMargin);
    titleLines.forEach((line: string) => {
      this.pdf.text(line, leftMargin, this.currentY);
      this.currentY += 7;
    });

    // Decorative Line
    this.pdf.setDrawColor(229, 231, 235);
    this.pdf.setLineWidth(0.5);
    this.pdf.line(leftMargin, this.currentY, rightMargin, this.currentY);
    this.currentY += 6;
  }

  /**
   * Add Document Metadata Box
   */
  private addMetadataCard(): void {
    const { leftMargin, rightMargin } = this.dimensions;
    const boxWidth = rightMargin - leftMargin;
    const boxHeight = 22;

    // Background fill light gray (#f9fafb)
    this.pdf.setFillColor(249, 250, 251);
    this.pdf.setDrawColor(229, 231, 235);
    this.pdf.rect(leftMargin, this.currentY, boxWidth, boxHeight, 'FD');

    const col1X = leftMargin + 4;
    const col2X = leftMargin + 65;
    const col3X = leftMargin + 125;

    this.pdf.setFontSize(8);
    this.pdf.setTextColor(107, 114, 128); // Gray 500

    // Row 1
    let y = this.currentY + 5;
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Jurisdiction:', col1X, y);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(17, 24, 39);
    this.pdf.text(`${this.policy.jurisdiction_name} (${this.policy.jurisdiction})`, col1X + 22, y);

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(107, 114, 128);
    this.pdf.text('Effective Date:', col2X, y);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(17, 24, 39);
    this.pdf.text(this.policy.effective_date, col2X + 24, y);

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(107, 114, 128);
    this.pdf.text('Version:', col3X, y);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(17, 24, 39);
    this.pdf.text(`v${this.policy.version}`, col3X + 16, y);

    // Row 2
    y += 6;
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(107, 114, 128);
    this.pdf.text('Target Audience:', col1X, y);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(17, 24, 39);
    this.pdf.text(this.policy.target_audience, col1X + 27, y);

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(107, 114, 128);
    this.pdf.text('Review Date:', col2X, y);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(17, 24, 39);
    this.pdf.text(this.policy.review_date || 'Annual', col2X + 22, y);

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(107, 114, 128);
    this.pdf.text('Status:', col3X, y);
    this.pdf.setFont('helvetica', 'bold');

    if (this.policy.status === 'published') {
      this.pdf.setTextColor(22, 163, 74); // Green
    } else if (this.policy.status === 'archived') {
      this.pdf.setTextColor(220, 38, 38); // Red
    } else {
      this.pdf.setTextColor(202, 138, 4); // Yellow/Orange
    }
    this.pdf.text(this.policy.status.toUpperCase(), col3X + 16, y);

    // Row 3
    y += 6;
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(107, 114, 128);
    this.pdf.text('Enforcement:', col1X, y);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(17, 24, 39);
    this.pdf.text(this.policy.enforcement_level, col1X + 24, y);

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(107, 114, 128);
    this.pdf.text('Entity:', col2X, y);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(17, 24, 39);
    this.pdf.text(this.company.company_name || 'Shared Entity', col2X + 16, y);

    this.currentY += boxHeight + 8;
  }

  /**
   * Add Policy Summary Section
   */
  private async addSummarySection(): Promise<void> {
    const { leftMargin, rightMargin } = this.dimensions;
    const contentWidth = rightMargin - leftMargin;

    await this.checkPageBreak(20);

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 58, 138);
    this.pdf.text('EXECUTIVE SUMMARY', leftMargin, this.currentY);
    this.currentY += 5;

    this.pdf.setFontSize(8.5);
    this.pdf.setFont('helvetica', 'italic');
    this.pdf.setTextColor(55, 65, 81);

    const summaryLines = this.pdf.splitTextToSize(this.policy.summary || '', contentWidth);
    for (const line of summaryLines) {
      await this.checkPageBreak(4);
      this.pdf.text(line, leftMargin, this.currentY);
      this.currentY += 4.5;
    }

    this.currentY += 5;
  }

  /**
   * Add Individual Policy Section
   */
  private async addPolicySection(section: { section_number: string; title: string; content: string }): Promise<void> {
    const { leftMargin, rightMargin } = this.dimensions;
    const contentWidth = rightMargin - leftMargin;

    await this.checkPageBreak(15);

    // Section Title
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(17, 24, 39);
    this.pdf.text(`${section.section_number} ${section.title}`, leftMargin, this.currentY);
    this.currentY += 6;

    // Section Content
    this.pdf.setFontSize(8.5);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(55, 65, 81);

    const lines = section.content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        this.currentY += 2;
        continue;
      }

      // Check if line is a bullet point or numbered item
      const isBullet = trimmedLine.startsWith('•') || trimmedLine.startsWith('-');
      const isNumbered = /^\d+\.\s/.test(trimmedLine);

      const indent = isBullet || isNumbered ? 4 : 0;
      const availableWidth = contentWidth - indent;

      const wrappedLines = this.pdf.splitTextToSize(trimmedLine, availableWidth);

      for (const wrappedLine of wrappedLines) {
        await this.checkPageBreak(4.5);
        this.pdf.text(wrappedLine, leftMargin + indent, this.currentY);
        this.currentY += 4.2;
      }
    }

    this.currentY += 4;
  }

  /**
   * Add Enforcement / Compliance Sign-off box
   */
  private async addEnforcementSignOff(): Promise<void> {
    const { leftMargin, rightMargin } = this.dimensions;
    const boxWidth = rightMargin - leftMargin;

    await this.checkPageBreak(30);

    this.currentY += 4;
    this.pdf.setFillColor(239, 246, 255); // Light Blue background (#eff6ff)
    this.pdf.setDrawColor(191, 219, 254);
    this.pdf.rect(leftMargin, this.currentY, boxWidth, 20, 'FD');

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 58, 138);
    this.pdf.text('COMPLIANCE & ENFORCEMENT ACKNOWLEDGMENT', leftMargin + 4, this.currentY + 5);

    this.pdf.setFontSize(7.5);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(31, 41, 55);

    const statement =
      'Adherence to this document is mandatory for all covered personnel. Violations of policy terms may result in disciplinary action up to and including termination of employment and legal proceedings where applicable.';
    const lines = this.pdf.splitTextToSize(statement, boxWidth - 8);
    let lineY = this.currentY + 10;
    lines.forEach((l: string) => {
      this.pdf.text(l, leftMargin + 4, lineY);
      lineY += 4;
    });

    this.currentY += 26;
  }

  /**
   * Finalize Document: Add Page numbers and Footer on all pages
   */
  private finalizeDocument(): void {
    const totalPages = this.pdf.getNumberOfPages();
    const { leftMargin, rightMargin, pageHeight } = this.dimensions;

    for (let i = 1; i <= totalPages; i++) {
      this.pdf.setPage(i);

      // Only add footer line if no custom image footer is set
      if (!this.company.footer_image_data) {
        const footerY = pageHeight - 12;

        this.pdf.setDrawColor(229, 231, 235);
        this.pdf.setLineWidth(0.3);
        this.pdf.line(leftMargin, footerY - 3, rightMargin, footerY - 3);

        this.pdf.setFontSize(7.5);
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.setTextColor(156, 163, 175);

        // Left Footer: Company Legal Name & Confidentiality Notice
        const compName = this.company.company_name || 'KDADKS';
        this.pdf.text(`${compName} • Strictly Confidential & Proprietary`, leftMargin, footerY);

        // Right Footer: Page X of Y
        this.pdf.text(`Page ${i} of ${totalPages}`, rightMargin, footerY, { align: 'right' });
      }
    }
  }
}

export default PolicyPDFGenerator;
