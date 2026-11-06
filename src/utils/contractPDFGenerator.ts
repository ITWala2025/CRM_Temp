/**
 * Contract PDF Generator
 * Generates professional multi-page contract PDFs with header/footer on each page
 */

import jsPDF from 'jspdf';
import { PDFBrandingUtils, PDFDimensions } from './pdfBrandingUtils';
import { formatCurrencyWithSymbol } from './currencyConverter';
import type { ContractWithDetails, ContractPDFOptions } from '../types/contract';
import type { CompanySettings } from '../types/invoice';

export class ContractPDFGenerator {
  
  private pdf: jsPDF;
  private dimensions: PDFDimensions;
  private contract: ContractWithDetails;
  private company: CompanySettings;
  private options: ContractPDFOptions;
  private currentY: number;
  private pageNumber: number;
  private contentStartY: number;
  private contentEndY: number;

  constructor(
    contract: ContractWithDetails,
    company: CompanySettings,
    options: Partial<ContractPDFOptions> = {}
  ) {
    this.contract = contract;
    this.company = company;
    this.options = {
      includePageNumbers: true,
      includeTableOfContents: false,
      includeSignatureBlocks: true,
      includeMilestones: true,
      includeParties: true,
      ...options
    };

    this.pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    this.dimensions = PDFBrandingUtils.getStandardDimensions();
    // 5mm margins on left and right, minimal on top/bottom for header/footer
    this.dimensions.leftMargin = 5;
    this.dimensions.rightMargin = this.pdf.internal.pageSize.getWidth() - 5;
    this.dimensions.topMargin = 2;
    this.dimensions.bottomMargin = 2;
    this.currentY = this.dimensions.topMargin;
    this.pageNumber = 1;
    this.contentStartY = this.dimensions.topMargin;
    this.contentEndY = this.pdf.internal.pageSize.getHeight() - this.dimensions.bottomMargin;
  }

  /**
   * Generate the complete contract PDF
   */
  async generate(): Promise<jsPDF> {
    // Apply branding to first page
    await this.applyPageBranding();

    // Add contract title (centered, bold)
    this.addContractTitle();

    // Add parties information
    if (this.options.includeParties !== false) {
      await this.addPartiesSection();
    }

    // Add preamble if present (without heading)
    if (this.contract.preamble && this.contract.preamble.trim()) {
      await this.addPreambleContent();
    }

    // Table of contents disabled - sections render with their content

    // Add all sections (must await each one to maintain order)
    for (const section of this.contract.sections) {
      await this.addSection(section);
    }

    // Add milestones if applicable
    if (this.options.includeMilestones && this.contract.milestones && this.contract.milestones.length > 0) {
      await this.addMilestonesSection();
    }

    // Add notes before signature blocks
    if (this.contract.notes && this.contract.notes.trim()) {
      await this.addNotesSection();
    }

    // Add signature blocks (must be last)
    if (this.options.includeSignatureBlocks) {
      await this.addSignatureBlocks();
    }

    // Apply branding and page numbers to all pages
    await this.finalizeDocument();

    return this.pdf;
  }

  /**
   * Apply header and footer branding to current page
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
   * Check if we need a new page
   */
  private async checkPageBreak(spaceNeeded: number, forceBreak: boolean = false): Promise<void> {
    if (forceBreak || this.currentY + spaceNeeded > this.contentEndY) {
      this.addPage();
      await this.applyPageBranding();
    }
  }

  /**
   * Add a new page
   */
  private addPage(): void {
    this.pdf.addPage();
    this.pageNumber++;
    this.currentY = this.contentStartY;
  }

  /**
   * Add contract details overlay on header image (no title, no type)
   * Called after branding is applied so details appear on top of header image
   */
  private addContractHeader(): void {
    const { leftMargin, rightMargin } = this.dimensions;

    // Add contract details on header image (positioned at top of page, inside header)
    // Use fixed Y position within header image area (around 10mm from top)
    const headerDetailsY = 10; // Fixed position within header image
    
    this.pdf.setTextColor(255, 255, 255); // WHITE text on header image
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');

    // Left side details
    let detailsY = headerDetailsY;
    this.pdf.text(`Contract Number: ${this.contract.contract_number}`, leftMargin + 2, detailsY);
    detailsY += 5;
    this.pdf.text(`Contract Date: ${new Date(this.contract.contract_date).toLocaleDateString('en-GB')}`, leftMargin + 2, detailsY);
    detailsY += 5;
    this.pdf.text(`Effective Date: ${new Date(this.contract.effective_date).toLocaleDateString('en-GB')}`, leftMargin + 2, detailsY);

    // Right side details
    detailsY = headerDetailsY;
    if (this.contract.expiry_date) {
      this.pdf.text(`Expiry Date: ${new Date(this.contract.expiry_date).toLocaleDateString('en-GB')}`, rightMargin - 2, detailsY, { align: 'right' });
      detailsY += 5;
    }

    // Don't show contract value (hidden per request)
    // const formattedValue = formatCurrencyWithSymbol(this.contract.contract_value || 0, this.contract.currency_code || 'EUR');
    // this.pdf.text(`Contract Value: ${formattedValue}`, rightMargin - 2, detailsY, { align: 'right' });

    // Reset text color for content
    this.pdf.setTextColor(0, 0, 0);
  }

  /**
   * Add contract title (centered, after header)
   */
  private addContractTitle(): void {
    const { leftMargin, rightMargin } = this.dimensions;
    const pageWidth = this.pdf.internal.pageSize.getWidth();
    const titleMaxWidth = rightMargin - leftMargin;

    // Add space after header (6mm padding)
    this.currentY += 6;

    // Contract title - centered, bold, larger font
    this.pdf.setFontSize(15);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(0, 0, 0);

    const titleText = this.contract.contract_title || 'CONTRACT';
    const titleLines = this.pdf.splitTextToSize(titleText, titleMaxWidth);
    titleLines.forEach((line: string) => {
      this.pdf.text(line, pageWidth / 2, this.currentY, { align: 'center' });
      this.currentY += 6;
    });
    
    // Add thin underline beneath title
    const lastLine = titleLines[titleLines.length - 1] || 'CONTRACT';
    const textWidth = Math.min(this.pdf.getTextWidth(lastLine), titleMaxWidth);
    const underlineX = (pageWidth - textWidth) / 2;
    const underlineY = this.currentY - 4;
    this.pdf.setLineWidth(0.2);
    this.pdf.line(underlineX, underlineY, underlineX + textWidth, underlineY);
    
    this.currentY += 4;
  }

  /**
   * Add parties information
   */
  private async addPartiesSection(): Promise<void> {
    const { leftMargin, rightMargin } = this.dimensions;
    const pageWidth = this.pdf.internal.pageSize.getWidth();
    const columnWidth = (rightMargin - leftMargin - 10) / 2;

    await this.checkPageBreak(35);

    this.pdf.setFontSize(10.5);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 58, 138); // Corporate Blue (#1e3a8a)
    this.pdf.text('PARTIES TO THE AGREEMENT', pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 5;

    // Draw top separator line
    this.pdf.setDrawColor(203, 213, 225); // Slate 300 (#cbd5e1)
    this.pdf.setLineWidth(0.3);
    this.pdf.line(leftMargin, this.currentY, rightMargin, this.currentY);
    this.currentY += 5;

    const partyBY = this.currentY;

    // Party A (Left Column)
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 58, 138);
    this.pdf.text('PARTY A (FIRST PARTY):', leftMargin, this.currentY);
    this.currentY += 4.5;

    this.pdf.setFontSize(8.5);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(15, 23, 42); // Slate 900
    const partyAName = this.contract.party_a_name || this.company?.company_name || 'Party A';
    const partyANameLines = this.pdf.splitTextToSize(partyAName, columnWidth);
    partyANameLines.forEach((line: string) => {
      this.pdf.text(line, leftMargin, this.currentY);
      this.currentY += 3.8;
    });

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(51, 65, 85); // Slate 700

    if (this.contract.party_a_address) {
      const addressLines = this.pdf.splitTextToSize(this.contract.party_a_address, columnWidth);
      addressLines.forEach((line: string) => {
        this.pdf.text(line, leftMargin, this.currentY);
        this.currentY += 3.5;
      });
    }

    if (this.contract.party_a_contact) {
      const contactLines = this.pdf.splitTextToSize(`Contact: ${this.contract.party_a_contact}`, columnWidth);
      contactLines.forEach((line: string) => {
        this.pdf.text(line, leftMargin, this.currentY);
        this.currentY += 3.5;
      });
    }

    if (this.contract.party_a_pan) {
      this.currentY += 0.5;
      const panLines = this.pdf.splitTextToSize(`PAN: ${this.contract.party_a_pan}`, columnWidth);
      panLines.forEach((line: string) => {
        this.pdf.text(line, leftMargin, this.currentY);
        this.currentY += 3.5;
      });
    }

    if (this.contract.party_a_gstin) {
      this.currentY += 0.5;
      const gstinLines = this.pdf.splitTextToSize(`GSTIN: ${this.contract.party_a_gstin}`, columnWidth);
      gstinLines.forEach((line: string) => {
        this.pdf.text(line, leftMargin, this.currentY);
        this.currentY += 3.5;
      });
    }

    if (this.contract.party_a_vat_number) {
      this.currentY += 0.5;
      const vatLines = this.pdf.splitTextToSize(`VAT Number: ${this.contract.party_a_vat_number}`, columnWidth);
      vatLines.forEach((line: string) => {
        this.pdf.text(line, leftMargin, this.currentY);
        this.currentY += 3.5;
      });
    }

    if (this.contract.party_a_cro_number) {
      this.currentY += 0.5;
      const croLines = this.pdf.splitTextToSize(`CRO Number: ${this.contract.party_a_cro_number}`, columnWidth);
      croLines.forEach((line: string) => {
        this.pdf.text(line, leftMargin, this.currentY);
        this.currentY += 3.5;
      });
    }

    const partyAEndY = this.currentY;

    // Party B (Right Column)
    this.currentY = partyBY;
    const col2X = leftMargin + columnWidth + 10;
    const col2Width = rightMargin - col2X;

    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 58, 138);
    this.pdf.text('PARTY B (SECOND PARTY):', col2X, this.currentY);
    this.currentY += 4.5;

    this.pdf.setFontSize(8.5);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(15, 23, 42); // Slate 900
    const partyBName = this.contract.party_b_name || 'Party B';
    const partyBNameLines = this.pdf.splitTextToSize(partyBName, col2Width);
    partyBNameLines.forEach((line: string) => {
      this.pdf.text(line, col2X, this.currentY);
      this.currentY += 3.8;
    });

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8);
    this.pdf.setTextColor(51, 65, 85); // Slate 700

    if (this.contract.party_b_address) {
      const addressLines = this.pdf.splitTextToSize(this.contract.party_b_address, col2Width);
      addressLines.forEach((line: string) => {
        this.pdf.text(line, col2X, this.currentY);
        this.currentY += 3.5;
      });
    }

    if (this.contract.party_b_contact) {
      const contactLines = this.pdf.splitTextToSize(`Contact: ${this.contract.party_b_contact}`, col2Width);
      contactLines.forEach((line: string) => {
        this.pdf.text(line, col2X, this.currentY);
        this.currentY += 3.5;
      });
    }

    if (this.contract.party_b_pan) {
      this.currentY += 0.5;
      const panLines = this.pdf.splitTextToSize(`PAN: ${this.contract.party_b_pan}`, col2Width);
      panLines.forEach((line: string) => {
        this.pdf.text(line, col2X, this.currentY);
        this.currentY += 3.5;
      });
    }

    if (this.contract.party_b_gstin) {
      this.currentY += 0.5;
      const gstinLines = this.pdf.splitTextToSize(`GSTIN: ${this.contract.party_b_gstin}`, col2Width);
      gstinLines.forEach((line: string) => {
        this.pdf.text(line, col2X, this.currentY);
        this.currentY += 3.5;
      });
    }

    if (this.contract.party_b_vat_number) {
      this.currentY += 0.5;
      const vatLines = this.pdf.splitTextToSize(`VAT Number: ${this.contract.party_b_vat_number}`, col2Width);
      vatLines.forEach((line: string) => {
        this.pdf.text(line, col2X, this.currentY);
        this.currentY += 3.5;
      });
    }

    if (this.contract.party_b_cro_number) {
      this.currentY += 0.5;
      const croLines = this.pdf.splitTextToSize(`CRO Number: ${this.contract.party_b_cro_number}`, col2Width);
      croLines.forEach((line: string) => {
        this.pdf.text(line, col2X, this.currentY);
        this.currentY += 3.5;
      });
    }

    // Set currentY to the maximum of both columns
    this.currentY = Math.max(partyAEndY, this.currentY);
    this.currentY += 3;

    // Draw bottom separator line
    this.pdf.setDrawColor(203, 213, 225); // Slate 300
    this.pdf.setLineWidth(0.3);
    this.pdf.line(leftMargin, this.currentY, rightMargin, this.currentY);
    this.currentY += 6;

    // Reset draw color and text color
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.setTextColor(0, 0, 0);
  }

  /**
   * Add preamble content (without heading)
   */
  private async addPreambleContent(): Promise<void> {
    const { leftMargin, rightMargin } = this.dimensions;
    const contentWidth = rightMargin - leftMargin;

    await this.checkPageBreak(15);

    // Render preamble content directly (no "PREAMBLE" heading, no separator lines)
    this.pdf.setFontSize(8.5);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(0, 0, 0);

    await this.renderSectionContent(this.contract.preamble || '', contentWidth, leftMargin);

    this.currentY += 6;
  }

  /**
   * Add table of contents
   */
  private addTableOfContents(): void {
    const { leftMargin } = this.dimensions;

    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('TABLE OF CONTENTS', leftMargin, this.currentY);
    this.currentY += 8;

    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');

    this.contract.sections.forEach((section) => {
      const sectionLine = `${section.section_number}. ${section.section_title}`;
      this.pdf.text(sectionLine, leftMargin + 5, this.currentY);
      this.currentY += 5;
    });

    this.currentY += 5;
  }

  /**
   * Add a contract section
   */
  private async addSection(section: typeof this.contract.sections[0]): Promise<void> {
    const { leftMargin, rightMargin } = this.dimensions;
    const contentWidth = rightMargin - leftMargin;
    const contentIndent = 3; // 3mm indentation for section content

    // Force page break if specified
    if (section.page_break_before) {
      await this.checkPageBreak(0, true);
    } else {
      await this.checkPageBreak(18);
    }

    // Section title - Enterprise accent bar and corporate blue font
    const sectionTitleText = `${section.section_number}. ${section.section_title}`;
    
    // Draw accent bar on left of section title
    this.pdf.setFillColor(30, 58, 138); // Corporate Blue (#1e3a8a)
    this.pdf.rect(leftMargin, this.currentY - 3.8, 2.5, 5.5, 'F');

    // Section title text
    this.pdf.setFontSize(10.5);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(30, 58, 138);
    this.pdf.text(sectionTitleText, leftMargin + 5, this.currentY);
    this.currentY += 6.5;

    // Reset font for section content
    this.pdf.setFontSize(8.5);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 41, 59); // Slate dark text (#1e293b)

    // Render section content
    await this.renderSectionContent(section.section_content, contentWidth - contentIndent, leftMargin + contentIndent);

    this.currentY += 4; // Space between sections
  }

  /**
   * Render section content with table support
   */
  private async renderSectionContent(content: string, maxWidth: number, leftMargin: number): Promise<void> {
    // If content is empty, don't render anything (section title is enough)
    if (!content || !content.trim()) {
      return;
    }

    // Check if content is HTML (from rich text editor)
    const isHTML = /<[a-z][\s\S]*>/i.test(content);
    
    if (isHTML) {
      // Handle HTML content from rich text editor
      await this.renderHTMLContent(content, maxWidth, leftMargin);
    } else {
      // Handle plain text with pipe-format tables (backward compatibility)
      await this.renderPlainTextContent(content, maxWidth, leftMargin);
    }
  }

  /**
   * Render HTML content from rich text editor
   */
  private async renderHTMLContent(htmlContent: string, maxWidth: number, leftMargin: number): Promise<void> {
    // Extract tables first
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let lastIndex = 0;
    let match;

    const parts: Array<{ type: 'text' | 'table', content: string }> = [];

    while ((match = tableRegex.exec(htmlContent)) !== null) {
      // Add text before table
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: htmlContent.substring(lastIndex, match.index)
        });
      }
      
      // Add table
      parts.push({
        type: 'table',
        content: match[0]
      });
      
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last table
    if (lastIndex < htmlContent.length) {
      parts.push({
        type: 'text',
        content: htmlContent.substring(lastIndex)
      });
    }

    // If no tables found, treat everything as text
    if (parts.length === 0) {
      parts.push({ type: 'text', content: htmlContent });
    }

    // Render each part
    for (const part of parts) {
      if (part.type === 'table') {
        await this.renderHTMLTable(part.content, maxWidth, leftMargin);
      } else {
        await this.renderPlainText(part.content, maxWidth, leftMargin);
      }
    }
  }

  /**
   * Render HTML table with smart column width allocation and per-row page break checking
   */
  private async renderHTMLTable(tableHTML: string, maxWidth: number, leftMargin: number): Promise<void> {
    // Parse table rows
    const rows: string[][] = [];
    
    // Extract rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(tableHTML)) !== null) {
      const rowContent = rowMatch[1];
      const cells: string[] = [];
      
      // Extract cells (th or td)
      const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/(th|td)>/gi;
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellText = cellMatch[2]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&ndash;/g, '–')
          .replace(/&mdash;/g, '—')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
          .trim();
        cells.push(cellText);
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) return;

    const numCols = Math.max(...rows.map(r => r.length));
    if (numCols === 0) return;

    // Pad rows so all rows have exactly numCols
    rows.forEach(r => {
      while (r.length < numCols) r.push('');
    });

    // Calculate smart proportional column widths
    const colWeights: number[] = new Array(numCols).fill(1);
    for (let c = 0; c < numCols; c++) {
      let maxLen = 0;
      let totalLen = 0;
      rows.forEach(r => {
        const len = (r[c] || '').length;
        maxLen = Math.max(maxLen, len);
        totalLen += len;
      });
      const avgLen = totalLen / rows.length;
      colWeights[c] = Math.max(avgLen, maxLen * 0.4, 2);
    }

    // Special sizing for index/number columns (#, S.No, Phase, ID)
    for (let c = 0; c < numCols; c++) {
      const headerText = (rows[0][c] || '').trim().toLowerCase();
      if (['#', 's.no', 'no.', 'sl.no', 'id', 'phase'].includes(headerText)) {
        colWeights[c] = 0.5; // Minimal weight for index columns
      }
    }

    const totalWeight = colWeights.reduce((sum, w) => sum + w, 0);
    const colWidths: number[] = colWeights.map(w => Math.max(10, (w / totalWeight) * maxWidth));

    // Normalize colWidths to sum exactly to maxWidth
    const sumWidths = colWidths.reduce((sum, w) => sum + w, 0);
    const scale = maxWidth / sumWidths;
    for (let c = 0; c < numCols; c++) {
      colWidths[c] = colWidths[c] * scale;
    }

    // Calculate row heights based on font size 7.5pt
    this.pdf.setFontSize(7.5);
    const rowHeights: number[] = [];
    rows.forEach((row) => {
      let maxLines = 1;
      row.forEach((cell, cIdx) => {
        const lines = cell.split('\n').flatMap(line => this.pdf.splitTextToSize(line, colWidths[cIdx] - 3));
        maxLines = Math.max(maxLines, lines.length);
      });
      rowHeights.push(Math.max(6, maxLines * 3.5 + 3));
    });

    // Helper to draw a single row
    const drawRow = (row: string[], rowIndex: number, yPos: number, rHeight: number) => {
      const isHeader = rowIndex === 0;
      let currentX = leftMargin;

      // Header or alternating row background
      if (isHeader) {
        this.pdf.setFillColor(235, 240, 248);
        this.pdf.rect(leftMargin, yPos, maxWidth, rHeight, 'F');
      } else if (rowIndex % 2 === 1) {
        this.pdf.setFillColor(250, 251, 253);
        this.pdf.rect(leftMargin, yPos, maxWidth, rHeight, 'F');
      }

      this.pdf.setFontSize(7.5);

      row.forEach((cell, colIndex) => {
        const cWidth = colWidths[colIndex];

        // Draw cell border
        this.pdf.setDrawColor(200, 205, 215);
        this.pdf.setLineWidth(0.15);
        this.pdf.rect(currentX, yPos, cWidth, rHeight);

        // Text formatting
        if (isHeader) {
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.setTextColor(20, 35, 60);
        } else {
          this.pdf.setFont('helvetica', 'normal');
          this.pdf.setTextColor(30, 30, 30);
        }

        const lines = cell.split('\n').flatMap(line => this.pdf.splitTextToSize(line, cWidth - 3));
        lines.forEach((line: string, lineIndex: number) => {
          this.pdf.text(line, currentX + 1.5, yPos + 3.8 + (lineIndex * 3.5));
        });

        currentX += cWidth;
      });
    };

    const headerHeight = rowHeights[0];
    await this.checkPageBreak(headerHeight + (rowHeights[1] || 6) + 2);

    for (let r = 0; r < rows.length; r++) {
      const rHeight = rowHeights[r];

      // Per-row page break check against contentEndY
      if (this.currentY + rHeight > this.contentEndY - 2) {
        await this.checkPageBreak(0, true); // Force page break
        
        // Re-print header row at top of new page if breaking in data rows
        if (r > 0) {
          drawRow(rows[0], 0, this.currentY, headerHeight);
          this.currentY += headerHeight;
        }
      }

      drawRow(rows[r], r, this.currentY, rHeight);
      this.currentY += rHeight;
    }

    this.currentY += 3; // Space after table
    this.pdf.setFontSize(8.5); // Reset font size
  }

  /**
   * Render plain text (HTML stripped) with enterprise-grade typography and hanging bullet indents
   */
  private async renderPlainText(htmlOrText: string, maxWidth: number, leftMargin: number): Promise<void> {
    // Strip HTML tags and convert to plain text
    const plainText = htmlOrText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<(ol|ul)[^>]*>/gi, '\n')
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '$1')
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '$1')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '$1')
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .replace(/\n\n+/g, '\n\n') // Reduce multiple blank lines to double
      .trim();

    if (!plainText) return;

    // Split by paragraphs
    const paragraphs = plainText.split('\n\n').filter(p => p.trim());
    
    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const paragraph = paragraphs[pIdx];
      const lines = paragraph.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Bullet point handling
        if (trimmedLine.startsWith('•') || trimmedLine.startsWith('*') || trimmedLine.startsWith('-')) {
          const bulletText = trimmedLine.replace(/^[•\*\-]\s*/, '');
          const wrappedBulletLines = this.pdf.splitTextToSize(bulletText, maxWidth - 6);

          await this.checkPageBreak(4.5);
          
          // Draw corporate blue bullet dot
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.setTextColor(30, 58, 138);
          this.pdf.text('•', leftMargin + 2, this.currentY);

          // Draw bullet text with clean hanging indent
          this.pdf.setFont('helvetica', 'normal');
          this.pdf.setTextColor(30, 41, 59);

          for (let bIdx = 0; bIdx < wrappedBulletLines.length; bIdx++) {
            if (bIdx > 0) {
              await this.checkPageBreak(4.2);
            }
            this.pdf.text(wrappedBulletLines[bIdx], leftMargin + 7, this.currentY);
            this.currentY += 4.2;
          }
          this.currentY += 0.8; // Gap after bullet item
        } else {
          // Regular paragraph line
          this.pdf.setFont('helvetica', 'normal');
          this.pdf.setTextColor(30, 41, 59);
          const wrappedLines = this.pdf.splitTextToSize(trimmedLine, maxWidth);

          for (const wrappedLine of wrappedLines) {
            await this.checkPageBreak(4.2);
            this.pdf.text(wrappedLine, leftMargin, this.currentY);
            this.currentY += 4.2;
          }
        }
      }
      
      // Add paragraph gap
      if (pIdx < paragraphs.length - 1) {
        this.currentY += 1.5;
      }
    }
  }

  /**
   * Render plain text content with pipe-format tables (backward compatibility)
   */
  private async renderPlainTextContent(content: string, maxWidth: number, leftMargin: number): Promise<void> {
    // Detect tables (simple pipe format)
    const lines = content.split('\n');
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Check if this is a table row (starts and ends with |)
      if (line.startsWith('|') && line.endsWith('|')) {
        // Found a table - collect all table rows
        const tableRows: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableRows.push(lines[i].trim());
          i++;
        }
        
        // Render the table
        await this.renderTable(tableRows, maxWidth, leftMargin);
      } else if (line) {
        // Regular text line
        const wrappedLines = this.pdf.splitTextToSize(line, maxWidth);
        for (const wrappedLine of wrappedLines) {
          await this.checkPageBreak(4);
          this.pdf.text(wrappedLine, leftMargin, this.currentY);
          this.currentY += 3.8;
        }
        i++;
      } else {
        // Empty line - add small gap
        this.currentY += 2;
        i++;
      }
    }
  }

  /**
   * Render a table from pipe-formatted rows with smart column width allocation and per-row page break checking
   */
  private async renderTable(rows: string[], maxWidth: number, leftMargin: number): Promise<void> {
    if (rows.length === 0) return;

    // Parse table structure
    const parsedRows = rows.map(row => 
      row.split('|')
        .filter((cell, idx, arr) => (idx > 0 && idx < arr.length - 1) || cell.trim())
        .map(cell => cell.trim())
    );

    // Skip separator rows (like |----|----|)
    const dataRows = parsedRows.filter(row => 
      !row.every(cell => /^-+$/.test(cell))
    );

    if (dataRows.length === 0) return;

    const numCols = Math.max(...dataRows.map(r => r.length));
    if (numCols === 0) return;

    dataRows.forEach(r => {
      while (r.length < numCols) r.push('');
    });

    // Calculate smart proportional column widths
    const colWeights: number[] = new Array(numCols).fill(1);
    for (let c = 0; c < numCols; c++) {
      let maxLen = 0;
      let totalLen = 0;
      dataRows.forEach(r => {
        const len = (r[c] || '').length;
        maxLen = Math.max(maxLen, len);
        totalLen += len;
      });
      const avgLen = totalLen / dataRows.length;
      colWeights[c] = Math.max(avgLen, maxLen * 0.4, 2);
    }

    for (let c = 0; c < numCols; c++) {
      const headerText = (dataRows[0][c] || '').trim().toLowerCase();
      if (['#', 's.no', 'no.', 'sl.no', 'id', 'phase'].includes(headerText)) {
        colWeights[c] = 0.5;
      }
    }

    const totalWeight = colWeights.reduce((sum, w) => sum + w, 0);
    const colWidths: number[] = colWeights.map(w => Math.max(10, (w / totalWeight) * maxWidth));

    const sumWidths = colWidths.reduce((sum, w) => sum + w, 0);
    const scale = maxWidth / sumWidths;
    for (let c = 0; c < numCols; c++) {
      colWidths[c] = colWidths[c] * scale;
    }

    this.pdf.setFontSize(7.5);
    const rowHeights: number[] = [];
    dataRows.forEach((row) => {
      let maxLines = 1;
      row.forEach((cell, cIdx) => {
        const lines = cell.split('\n').flatMap(line => this.pdf.splitTextToSize(line, colWidths[cIdx] - 3));
        maxLines = Math.max(maxLines, lines.length);
      });
      rowHeights.push(Math.max(6, maxLines * 3.5 + 3));
    });

    const drawRow = (row: string[], rowIndex: number, yPos: number, rHeight: number) => {
      const isHeader = rowIndex === 0;
      let currentX = leftMargin;

      if (isHeader) {
        this.pdf.setFillColor(235, 240, 248);
        this.pdf.rect(leftMargin, yPos, maxWidth, rHeight, 'F');
      } else if (rowIndex % 2 === 1) {
        this.pdf.setFillColor(250, 251, 253);
        this.pdf.rect(leftMargin, yPos, maxWidth, rHeight, 'F');
      }

      this.pdf.setFontSize(7.5);

      row.forEach((cell, colIndex) => {
        const cWidth = colWidths[colIndex];

        this.pdf.setDrawColor(200, 205, 215);
        this.pdf.setLineWidth(0.15);
        this.pdf.rect(currentX, yPos, cWidth, rHeight);

        if (isHeader) {
          this.pdf.setFont('helvetica', 'bold');
          this.pdf.setTextColor(20, 35, 60);
        } else {
          this.pdf.setFont('helvetica', 'normal');
          this.pdf.setTextColor(30, 30, 30);
        }

        const lines = cell.split('\n').flatMap(line => this.pdf.splitTextToSize(line, cWidth - 3));
        lines.forEach((line: string, lineIndex: number) => {
          this.pdf.text(line, currentX + 1.5, yPos + 3.8 + (lineIndex * 3.5));
        });

        currentX += cWidth;
      });
    };

    const headerHeight = rowHeights[0];
    await this.checkPageBreak(headerHeight + (rowHeights[1] || 6) + 2);

    for (let r = 0; r < dataRows.length; r++) {
      const rHeight = rowHeights[r];

      if (this.currentY + rHeight > this.contentEndY - 2) {
        await this.checkPageBreak(0, true);
        
        if (r > 0) {
          drawRow(dataRows[0], 0, this.currentY, headerHeight);
          this.currentY += headerHeight;
        }
      }

      drawRow(dataRows[r], r, this.currentY, rHeight);
      this.currentY += rHeight;
    }

    this.currentY += 3;
    this.pdf.setFontSize(8.5);
  }

  /**
   * Parse HTML/rich text content and split into lines
   */
  private parseAndSplitContent(content: string, maxWidth: number): string[] {
    // Remove HTML tags (basic sanitization)
    const plainText = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    // Split by newlines first
    const paragraphs = plainText.split('\n').filter(p => p.trim());
    
    const allLines: string[] = [];
    
    paragraphs.forEach(para => {
      const lines = this.pdf.splitTextToSize(para, maxWidth);
      allLines.push(...lines);
      allLines.push(''); // Add spacing between paragraphs
    });

    return allLines;
  }

  /**
   * Add milestones section
   */
  private async addMilestonesSection(): Promise<void> {
    if (!this.contract.milestones || this.contract.milestones.length === 0) return;

    const { leftMargin, rightMargin } = this.dimensions;
    const pageWidth = this.pdf.internal.pageSize.getWidth();

    await this.checkPageBreak(20);

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('PROJECT MILESTONES', pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 6;

    this.pdf.setLineWidth(0.3);
    this.pdf.line(leftMargin, this.currentY, rightMargin, this.currentY);
    this.currentY += 5;

    for (const milestone of this.contract.milestones) {
      await this.checkPageBreak(18);

      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(0, 0, 0);
      this.pdf.text(`Milestone ${milestone.milestone_number}: ${milestone.milestone_title}`, leftMargin, this.currentY);
      this.currentY += 5;

      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(0, 0, 0);

      if (milestone.description) {
        const descLines = this.pdf.splitTextToSize(milestone.description, rightMargin - leftMargin);
        descLines.forEach((line: string) => {
          this.pdf.text(line, leftMargin + 3, this.currentY);
          this.currentY += 3.5;
        });
      }

      if (milestone.deliverables) {
        this.currentY += 1;
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text('Deliverables:', leftMargin + 3, this.currentY);
        this.pdf.setFont('helvetica', 'normal');
        this.currentY += 3.5;
        const delivLines = this.pdf.splitTextToSize(milestone.deliverables, rightMargin - leftMargin - 6);
        delivLines.forEach((line: string) => {
          this.pdf.text(line, leftMargin + 6, this.currentY);
          this.currentY += 3.5;
        });
      }

      const infoY = this.currentY + 1;
      if (milestone.due_date) {
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text('Due Date:', leftMargin + 3, infoY);
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.text(new Date(milestone.due_date).toLocaleDateString('en-GB'), leftMargin + 20, infoY);
      }

      if (milestone.payment_amount) {
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text('Payment:', leftMargin + 60, infoY);
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.text(`${this.contract.currency_code} ${milestone.payment_amount.toLocaleString('en-IN')}`, leftMargin + 75, infoY);
      }

      this.currentY = infoY + 5;
    }
  }

  /**
   * Add notes section before signature blocks
   */
  private async addNotesSection(): Promise<void> {
    const { leftMargin, rightMargin } = this.dimensions;
    const maxWidth = rightMargin - leftMargin;

    await this.checkPageBreak(20);

    this.currentY += 2;

    // Notes content (no "NOTES:" heading)
    if (this.contract.notes && this.contract.notes.trim()) {
      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'normal');
      const noteLines = this.pdf.splitTextToSize(this.contract.notes, maxWidth - 4);
      
      for (const line of noteLines) {
        await this.checkPageBreak(4);
        this.pdf.text(line, leftMargin, this.currentY);
        this.currentY += 4.2;
      }
    }
  }

  /**
   * Add signature blocks
   */
  private async addSignatureBlocks(): Promise<void> {
    const { leftMargin, rightMargin } = this.dimensions;
    const columnWidth = (rightMargin - leftMargin - 10) / 2;

    await this.checkPageBreak(20);

    this.currentY += 10;

    // Signature blocks directly (no "AGREED AND ACCEPTED:" heading)
    const signatureY = this.currentY;

    // Party A signature (Left)
    this.pdf.setLineWidth(0.3);
    this.pdf.line(leftMargin, this.currentY, leftMargin + columnWidth - 10, this.currentY);
    this.currentY += 5;

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Party A Signature', leftMargin, this.currentY);
    this.currentY += 4;

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(7.5);
    const partyANameSigLines = this.pdf.splitTextToSize(this.contract.party_a_name || '', columnWidth - 10);
    partyANameSigLines.forEach((line: string) => {
      this.pdf.text(line, leftMargin, this.currentY);
      this.currentY += 3;
    });
    
    if (this.contract.party_a_contact) {
      const contactLines = this.pdf.splitTextToSize(this.contract.party_a_contact, columnWidth - 10);
      contactLines.forEach((line: string) => {
        this.pdf.text(line, leftMargin, this.currentY);
        this.currentY += 3;
      });
    }

    this.pdf.text('Date: __________________', leftMargin, this.currentY);
    const partyASigEndY = this.currentY;

    // Party B signature (Right)
    this.currentY = signatureY;
    const col2X = leftMargin + columnWidth + 10;
    const col2Width = rightMargin - col2X;

    this.pdf.setLineWidth(0.3);
    this.pdf.line(col2X, this.currentY, rightMargin, this.currentY);
    this.currentY += 5;

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Party B Signature', col2X, this.currentY);
    this.currentY += 4;

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(7.5);
    const partyBNameSigLines = this.pdf.splitTextToSize(this.contract.party_b_name || '', col2Width);
    partyBNameSigLines.forEach((line: string) => {
      this.pdf.text(line, col2X, this.currentY);
      this.currentY += 3;
    });
    
    if (this.contract.party_b_contact) {
      const contactLines = this.pdf.splitTextToSize(this.contract.party_b_contact, col2Width);
      contactLines.forEach((line: string) => {
        this.pdf.text(line, col2X, this.currentY);
        this.currentY += 3;
      });
    }

    this.pdf.text('Date: __________________', col2X, this.currentY);

    this.currentY = Math.max(partyASigEndY, this.currentY);
  }

  /**
   * Finalize document - add page numbers and branding to all pages
   */
  private async finalizeDocument(): Promise<void> {
    const totalPages = this.pdf.getNumberOfPages();

    // Apply branding and page numbers to all pages
    for (let i = 1; i <= totalPages; i++) {
      this.pdf.setPage(i);

      // Apply branding (header/footer) to all pages
      await PDFBrandingUtils.applyBranding(this.pdf, this.company, this.dimensions);

      // Add contract header details AFTER branding on page 1 (so it appears on top)
      if (i === 1) {
        this.addContractHeader();
      }

      // Add page numbers only if there are multiple pages
      if (this.options.includePageNumbers && totalPages > 1) {
        this.pdf.setFontSize(8);
        this.pdf.setTextColor(120, 120, 120);
        this.pdf.setFont('helvetica', 'normal');
        
        const pageText = `Page ${i} of ${totalPages}`;
        const pageWidth = this.pdf.internal.pageSize.getWidth();
        this.pdf.text(pageText, pageWidth / 2, this.contentEndY + 12, { align: 'center' });
      }

      // Add "Confidential" footer on last page only
      if (i === totalPages) {
        this.pdf.setFontSize(7);
        this.pdf.setTextColor(150, 150, 150);
        this.pdf.setFont('helvetica', 'italic');
        const pageWidth = this.pdf.internal.pageSize.getWidth();
        this.pdf.text(
          'This contract is confidential and legally binding',
          pageWidth / 2,
          this.contentEndY + 8,
          { align: 'center' }
        );
      }
    }
  }
}

/**
 * Helper function to generate contract PDF
 */
export async function generateContractPDF(
  contract: ContractWithDetails,
  company: CompanySettings,
  options?: Partial<ContractPDFOptions>
): Promise<jsPDF> {
  const generator = new ContractPDFGenerator(contract, company, options);
  return await generator.generate();
}

export default { ContractPDFGenerator, generateContractPDF };
