/**
 * Board Resolution PDF Generator
 * Uses the same jsPDF + PDFBrandingUtils template as Invoice PDFs for visual consistency.
 */

import jsPDF from 'jspdf';
import { PDFBrandingUtils } from './pdfBrandingUtils';
import type { BoardResolution } from '../types/boardResolution';
import type { CompanySettings } from '../types/invoice';
import { getCompanyTaxFields } from '../utils/taxUtils';

export async function generateBoardResolutionPDF(
  resolution: BoardResolution,
  company: CompanySettings
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  pdf.setFont('helvetica');

  const dimensions = PDFBrandingUtils.getStandardDimensions();
  const { leftMargin, rightMargin } = dimensions;

  // Apply branding (header image, footer image, logo) — identical to invoice
  const { contentStartY, contentEndY } = await PDFBrandingUtils.applyBranding(pdf, company, dimensions);

  // ─── Branded header bar ────────────────────────────────────────────────────
  let yPos: number;
  if (company.header_image_data) {
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('BOARD RESOLUTION', leftMargin, 17);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`#${resolution.resolution_number}`, rightMargin, 8, { align: 'right' });
    pdf.text(
      `Date: ${new Date(resolution.resolution_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      rightMargin,
      14,
      { align: 'right' }
    );
    pdf.text(`Status: ${resolution.status.toUpperCase()}`, rightMargin, 20, { align: 'right' });
    yPos = contentStartY;
  } else {
    pdf.setFillColor(37, 99, 235);
    pdf.rect(0, contentStartY, dimensions.pageWidth, 25, 'F');

    pdf.setFontSize(16);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text('BOARD RESOLUTION', leftMargin, contentStartY + 12);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`#${resolution.resolution_number}`, rightMargin, contentStartY + 8, { align: 'right' });
    pdf.text(
      `Date: ${new Date(resolution.resolution_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      rightMargin,
      contentStartY + 14,
      { align: 'right' }
    );
    pdf.text(`Status: ${resolution.status.toUpperCase()}`, rightMargin, contentStartY + 20, { align: 'right' });
    yPos = contentStartY + 30;
  }

  pdf.setTextColor(0, 0, 0);

  // ─── Company details ───────────────────────────────────────────────────────
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text(company.company_name, leftMargin, yPos);
  yPos += 5;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);

  if (company.legal_name && company.legal_name !== company.company_name) {
    pdf.text(company.legal_name, leftMargin, yPos);
    yPos += 4;
  }
  if (company.address_line1) {
    pdf.text(company.address_line1, leftMargin, yPos);
    yPos += 4;
  }
  if (company.address_line2) {
    pdf.text(company.address_line2, leftMargin, yPos);
    yPos += 4;
  }
  const location = [company.city, company.state, company.postal_code].filter(Boolean).join(', ');
  if (location) { pdf.text(location, leftMargin, yPos); yPos += 4; }
  const companyTaxFields = getCompanyTaxFields(company.country?.code);
  companyTaxFields.fields.forEach((field) => {
    const value = company[field.key as keyof CompanySettings] as string | undefined;
    if (value) {
      pdf.text(`${field.label}: ${value}`, leftMargin, yPos);
      yPos += 4;
    }
  });
  if (company.email) { pdf.text(`Email: ${company.email}`, leftMargin, yPos); yPos += 4; }
  if (company.phone) { pdf.text(`Phone: ${company.phone}`, leftMargin, yPos); yPos += 4; }

  yPos += 4;

  // ─── Divider ──────────────────────────────────────────────────────────────
  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.5);
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 6;

  // ─── Resolution title block ────────────────────────────────────────────────
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  const titleLines = pdf.splitTextToSize(resolution.title, rightMargin - leftMargin);
  pdf.text(titleLines, (leftMargin + rightMargin) / 2, yPos, { align: 'center' });
  yPos += titleLines.length * 6 + 2;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  pdf.text(`Board Action: ${resolution.board_action}`, (leftMargin + rightMargin) / 2, yPos, { align: 'center' });
  yPos += 8;

  // ─── Meeting details box ───────────────────────────────────────────────────
  pdf.setFillColor(239, 246, 255);
  pdf.setDrawColor(191, 219, 254);
  pdf.rect(leftMargin, yPos, rightMargin - leftMargin, 14, 'FD');

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 64, 175);
  pdf.text('Meeting Details', leftMargin + 3, yPos + 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  const meetingDate = new Date(resolution.resolution_date).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  pdf.text(`Date: ${meetingDate}`, leftMargin + 3, yPos + 10);
  if (resolution.chairperson) {
    pdf.text(`Chairperson: ${resolution.chairperson}`, rightMargin - 3, yPos + 10, { align: 'right' });
  }
  yPos += 18;

  // ─── Preamble ─────────────────────────────────────────────────────────────
  if (resolution.preamble?.trim()) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(37, 99, 235);
    pdf.text('PREAMBLE', leftMargin, yPos);
    yPos += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    const preambleLines = pdf.splitTextToSize(resolution.preamble, rightMargin - leftMargin);
    for (const line of preambleLines) {
      if (yPos > contentEndY - 10) {
        pdf.addPage();
        await PDFBrandingUtils.applyBranding(pdf, company, dimensions);
        yPos = contentStartY;
      }
      pdf.text(line, leftMargin, yPos);
      yPos += 4.5;
    }
    yPos += 4;
  }

  // ─── Resolution text ──────────────────────────────────────────────────────
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(37, 99, 235);
  pdf.text('RESOLVED THAT', leftMargin, yPos);
  yPos += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  const resolutionLines = pdf.splitTextToSize(resolution.resolution_text, rightMargin - leftMargin);
  for (const line of resolutionLines) {
    if (yPos > contentEndY - 10) {
      pdf.addPage();
      await PDFBrandingUtils.applyBranding(pdf, company, dimensions);
      yPos = contentStartY;
    }
    pdf.text(line, leftMargin, yPos);
    yPos += 4.5;
  }
  yPos += 6;

  // ─── Directors present ────────────────────────────────────────────────────
  if (resolution.directors_present.length > 0) {
    if (yPos > contentEndY - 40) {
      pdf.addPage();
      await PDFBrandingUtils.applyBranding(pdf, company, dimensions);
      yPos = contentStartY;
    }

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(37, 99, 235);
    pdf.text('DIRECTORS PRESENT', leftMargin, yPos);
    yPos += 5;

    // Table header
    pdf.setFillColor(37, 99, 235);
    pdf.rect(leftMargin, yPos, rightMargin - leftMargin, 6, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('S.No.', leftMargin + 3, yPos + 4);
    pdf.text('Name of Director', leftMargin + 20, yPos + 4);
    yPos += 6;

    resolution.directors_present.forEach((name, idx) => {
      const bg = idx % 2 === 0 ? [239, 246, 255] : [255, 255, 255];
      pdf.setFillColor(bg[0], bg[1], bg[2]);
      pdf.rect(leftMargin, yPos, rightMargin - leftMargin, 6, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(String(idx + 1), leftMargin + 3, yPos + 4);
      pdf.text(name, leftMargin + 20, yPos + 4);
      yPos += 6;
    });
    yPos += 4;
  }

  // Directors absent (optional)
  if (resolution.directors_absent?.length > 0) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(60, 60, 60);
    pdf.text(`Directors Absent (Leave of Absence): ${resolution.directors_absent.join(', ')}`, leftMargin, yPos);
    yPos += 7;
  }

  // ─── Passed by ────────────────────────────────────────────────────────────
  if (resolution.status === 'passed' && resolution.passed_by !== 'not_voted') {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 128, 0);
    const passedText = resolution.passed_by === 'unanimous'
      ? 'RESOLVED UNANIMOUSLY'
      : 'RESOLVED BY MAJORITY';
    pdf.text(passedText, (leftMargin + rightMargin) / 2, yPos, { align: 'center' });
    yPos += 8;
  }

  // ─── Notes ────────────────────────────────────────────────────────────────
  if (resolution.notes?.trim()) {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100, 100, 100);
    pdf.text('Notes:', leftMargin, yPos);
    yPos += 4;
    pdf.setFont('helvetica', 'normal');
    const noteLines = pdf.splitTextToSize(resolution.notes, rightMargin - leftMargin);
    pdf.text(noteLines, leftMargin, yPos);
    yPos += noteLines.length * 4 + 6;
  }

  // ─── Signature section ────────────────────────────────────────────────────
  if (yPos > contentEndY - 35) {
    pdf.addPage();
    await PDFBrandingUtils.applyBranding(pdf, company, dimensions);
    yPos = contentStartY;
  }

  yPos += 4;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 8;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Certified True Copy', leftMargin, yPos);
  yPos += 12;

  // Two-column signature blocks
  const midX = (leftMargin + rightMargin) / 2 + 10;
  const sigWidth = 50;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  // Left sig line
  pdf.line(leftMargin, yPos, leftMargin + sigWidth, yPos);
  // Right sig line
  pdf.line(midX, yPos, midX + sigWidth, yPos);

  yPos += 5;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 80, 80);
  pdf.text('Chairperson', leftMargin, yPos);
  pdf.text('Director / Authorised Signatory', midX, yPos);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const filename = `BoardResolution-${resolution.resolution_number.replace(/\//g, '-')}.pdf`;
  pdf.save(filename);
}
