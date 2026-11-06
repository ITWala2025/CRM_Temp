/**
 * ITWala Academy Internship Program – Document Templates Utility
 *
 * Provides:
 *   1. Version-control helpers & RBAC configuration
 *   2. Validation functions for required fields
 *   3. Legal disclaimer & compliance text
 *   4. PDF generators for Intern Offer Letter and Experience Certificate
 *   5. Default form-data factories
 *
 * Template version: ITWala-Intern-v1.0.0
 * Last modified: 2026-04-23
 * Author: ITWala HR Systems
 * Approval status: approved
 */

import jsPDF from 'jspdf';
import { PDFBrandingUtils } from './pdfBrandingUtils';
import type {
  Employee,
  InternOfferLetterData,
  InternExperienceCertificateData,
  DocumentVersionMeta,
  InternDocumentRBAC,
  ApprovalStatus,
} from '../types/employee';
import type { CompanySettings } from '../types/invoice';

// ─── Template Constants ───────────────────────────────────────────────────────

export const INTERN_TEMPLATE_VERSION = 'ITWala-Intern-v1.0.0';
export const PROGRAM_NAME_DEFAULT = 'ITWala Academy Internship Program';

// ─── RBAC Configuration ───────────────────────────────────────────────────────

/**
 * Role-Based Access Control for intern documents.
 *
 * viewer    – read-only; can download published PDFs
 * editor    – can create/edit drafts and pending_approval docs
 * approver  – can approve/reject documents; cannot publish
 * publisher – can publish approved documents to the employee portal
 */
export const INTERN_DOCUMENT_RBAC: InternDocumentRBAC = {
  viewer:    ['view', 'download'],
  editor:    ['view', 'download', 'create', 'edit_draft', 'submit_for_approval'],
  approver:  ['view', 'download', 'approve', 'reject', 'add_comments'],
  publisher: ['view', 'download', 'approve', 'reject', 'publish', 'archive'],
};

/** Returns whether a given role can perform a specific action */
export function canPerformAction(role: keyof InternDocumentRBAC, action: string): boolean {
  return INTERN_DOCUMENT_RBAC[role]?.includes(action) ?? false;
}

// ─── Version-Control Helpers ─────────────────────────────────────────────────

/** Creates a fresh DocumentVersionMeta for a new document */
export function createVersionMeta(
  author: string,
  overrides?: Partial<DocumentVersionMeta>
): DocumentVersionMeta {
  const now = new Date().toISOString();
  return {
    version: '1.0.0',
    created_at: now,
    modified_at: now,
    author,
    approval_status: 'draft',
    template_version: INTERN_TEMPLATE_VERSION,
    document_ref: `ITWALA-INTERN-${Date.now()}`,
    ...overrides,
  };
}

/** Bumps the patch version and updates modified_at */
export function bumpVersion(meta: DocumentVersionMeta, by: 'patch' | 'minor' | 'major' = 'patch'): DocumentVersionMeta {
  const [major, minor, patch] = meta.version.split('.').map(Number);
  let newVersion: string;
  if (by === 'major') newVersion = `${major + 1}.0.0`;
  else if (by === 'minor') newVersion = `${major}.${minor + 1}.0`;
  else newVersion = `${major}.${minor}.${patch + 1}`;
  return { ...meta, version: newVersion, modified_at: new Date().toISOString() };
}

/** Transitions a document to the next approval status */
export function transitionApprovalStatus(
  meta: DocumentVersionMeta,
  newStatus: ApprovalStatus,
  approvedBy?: string
): DocumentVersionMeta {
  return {
    ...meta,
    approval_status: newStatus,
    approved_by: approvedBy ?? meta.approved_by,
    modified_at: new Date().toISOString(),
  };
}

// ─── Legal Disclaimer Text ────────────────────────────────────────────────────

export const INTERN_LEGAL_DISCLAIMER = `This internship is offered under the ITWala Academy Internship Program and is governed by applicable Indian labour laws, including but not limited to the Apprentices Act 1961 and the National Apprenticeship Promotion Scheme (NAPS) guidelines where applicable. The internship is primarily educational in nature and does not constitute regular employment. The intern is not entitled to statutory employment benefits (PF, ESIC, gratuity) unless explicitly stated. The company reserves the right to terminate the internship at any time for conduct unbecoming of an intern or breach of any clause herein. All work product created during the internship remains the exclusive intellectual property of Kdadks / ITWala Academy. The intern agrees to maintain strict confidentiality of all proprietary information encountered during the program.`;

export const INTERN_CONFIDENTIALITY_CLAUSE = `The intern agrees to keep all information relating to the company's business, clients, technology, processes, and trade secrets strictly confidential, both during and for a period of two (2) years after the conclusion of the internship. Unauthorized disclosure may result in legal action.`;

export const INTERN_IP_ASSIGNMENT_CLAUSE = `All inventions, developments, improvements, and other intellectual property created by the intern in the course of the internship shall be the sole and exclusive property of Kdadks / ITWala Academy. The intern hereby assigns all rights, title, and interest in such work product to the company.`;

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/** Validates required and recommended fields for an Intern Offer Letter */
export function validateInternOfferLetter(data: Partial<InternOfferLetterData>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!data.position?.trim()) errors.push('Intern role / position is required.');
  if (!data.department?.trim()) errors.push('Department is required.');
  if (!data.joining_date) errors.push('Internship start date (joining_date) is required.');
  if (!data.end_date) errors.push('Internship end date is required.');
  if (!data.program_name?.trim()) errors.push('Program name is required (e.g., "ITWala Academy Internship Program").');

  // Date logic
  if (data.joining_date && data.end_date) {
    const start = new Date(data.joining_date);
    const end = new Date(data.end_date);
    if (end <= start) {
      errors.push('End date must be after the start date.');
    }
  }

  // Stipend consistency
  if (data.is_paid === true && (!data.stipend_amount || data.stipend_amount <= 0)) {
    errors.push('Stipend amount must be greater than zero for a paid internship.');
  }

  // Recommended (warnings)
  if (!data.supervisor_name?.trim()) warnings.push('Supervisor name is recommended for clarity.');
  if (!data.duties_and_responsibilities?.trim()) warnings.push('Duties and responsibilities are recommended.');
  if (!data.internship_scope?.trim()) warnings.push('Internship scope description is recommended.');

  return { isValid: errors.length === 0, errors, warnings };
}

/** Validates required and recommended fields for an Intern Experience Certificate */
export function validateInternExperienceCertificate(
  data: Partial<InternExperienceCertificateData>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.employee_name?.trim()) errors.push('Intern name is required.');
  if (!data.designation?.trim()) errors.push('Intern designation / role title is required.');
  if (!data.date_of_joining) errors.push('Internship start date is required.');
  if (!data.last_working_date) errors.push('Internship end date is required.');
  if (!data.program_name?.trim()) errors.push('Program name is required.');

  if (data.date_of_joining && data.last_working_date) {
    const start = new Date(data.date_of_joining);
    const end = new Date(data.last_working_date);
    if (end < start) {
      errors.push('Last working date must be after the joining date.');
    }
  }

  if (!data.signatory_name?.trim()) warnings.push('Signatory name is recommended.');
  if (!data.signatory_designation?.trim()) warnings.push('Signatory designation is recommended.');

  return { isValid: errors.length === 0, errors, warnings };
}

// ─── Date Utility ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function calcDurationMonths(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const months =
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (months < 1) {
    const days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  return `${months} month${months !== 1 ? 's' : ''}`;
}

// ─── PDF Generator: Intern Offer Letter ──────────────────────────────────────

/**
 * Generates a jsPDF instance for an ITWala Academy Internship Offer Letter.
 * Extends the base offer-letter template with internship-specific sections
 * (scope, duration, unpaid status disclaimer, supervisor, IP/NDA clauses).
 */
export async function generateInternOfferLetterPDF(
  employee: Employee,
  data: InternOfferLetterData,
  companySettings: CompanySettings | null,
  signatoryName?: string,
  signatoryDesignation?: string
): Promise<jsPDF> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  pdf.setFont('helvetica');

  const dimensions = PDFBrandingUtils.getStandardDimensions();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const companyName = companySettings?.company_name || 'Kdadks';
  const programName = data.program_name || PROGRAM_NAME_DEFAULT;

  const FONT_SIZE = { title: 13, heading: 10, body: 10, small: 9 };
  const LINE_HEIGHT = 5;
  const SECTION_GAP = 8;
  const PARAGRAPH_GAP = 6;

  let contentStartY = dimensions.topMargin;
  let contentEndY = pageHeight - dimensions.bottomMargin;

  if (companySettings) {
    const br = await PDFBrandingUtils.applyBranding(pdf, companySettings, dimensions);
    contentStartY = br.contentStartY;
    contentEndY = br.contentEndY;
  }

  let currentY = contentStartY;

  const addNewPage = async () => {
    pdf.addPage();
    if (companySettings) {
      const br = await PDFBrandingUtils.applyBranding(pdf, companySettings, dimensions);
      contentStartY = br.contentStartY;
      contentEndY = br.contentEndY;
    }
    currentY = contentStartY;
  };

  const checkBreak = async (space: number) => {
    if (currentY + space > contentEndY) await addNewPage();
  };

  const writeWrapped = async (text: string, indent = 0) => {
    const lines = pdf.splitTextToSize(text, dimensions.rightMargin - dimensions.leftMargin - indent);
    for (const line of lines) {
      await checkBreak(LINE_HEIGHT + 2);
      pdf.text(line, dimensions.leftMargin + indent, currentY);
      currentY += LINE_HEIGHT;
    }
  };

  const writeSectionHeading = async (heading: string) => {
    await checkBreak(15);
    pdf.setFontSize(FONT_SIZE.heading);
    pdf.setFont('helvetica', 'bold');
    pdf.text(heading, dimensions.leftMargin, currentY);
    currentY += SECTION_GAP;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(FONT_SIZE.body);
  };

  const writeBullet = async (text: string) => {
    await checkBreak(LINE_HEIGHT + 2);
    pdf.text('•', dimensions.leftMargin + 3, currentY);
    const lines = pdf.splitTextToSize(text, dimensions.rightMargin - dimensions.leftMargin - 10);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) await checkBreak(LINE_HEIGHT + 2);
      pdf.text(lines[i], dimensions.leftMargin + 8, currentY);
      if (i < lines.length - 1) currentY += LINE_HEIGHT;
    }
    currentY += LINE_HEIGHT;
  };

  // ── Version metadata footer helper ─────────────────────────────────────────
  const writeVersionFooter = async () => {
    if (data.version_meta) {
      await checkBreak(20);
      currentY += 8;
      pdf.setFontSize(FONT_SIZE.small - 1);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(150, 150, 150);
      const { version, template_version, created_at, approval_status, document_ref } = data.version_meta;
      pdf.text(
        `Doc Ref: ${document_ref ?? '—'} | Version: ${version} | Template: ${template_version} | Status: ${approval_status} | Created: ${new Date(created_at).toLocaleDateString('en-GB')}`,
        dimensions.leftMargin,
        currentY
      );
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(FONT_SIZE.body);
    }
  };

  // ── Header ─────────────────────────────────────────────────────────────────
  if (!companySettings?.header_image_data) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(companyName, dimensions.leftMargin, currentY);
    currentY += 10;
    pdf.setFontSize(FONT_SIZE.small);
    pdf.setFont('helvetica', 'italic');
    pdf.text(programName, dimensions.leftMargin, currentY);
    currentY += 10;
    pdf.setFont('helvetica', 'normal');
  }

  pdf.setFontSize(FONT_SIZE.body);
  const offerDate = data.offer_date ? formatDate(data.offer_date) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  pdf.text(`Date: ${offerDate}`, dimensions.leftMargin, currentY);
  currentY += 10;

  // ── Addressee ──────────────────────────────────────────────────────────────
  pdf.text('To,', dimensions.leftMargin, currentY);
  currentY += LINE_HEIGHT;
  pdf.setFont('helvetica', 'bold');
  pdf.text(employee.full_name, dimensions.leftMargin, currentY);
  currentY += LINE_HEIGHT;
  pdf.setFont('helvetica', 'normal');

  if (data.candidate_address) {
    await writeWrapped(data.candidate_address);
  } else if (employee.address_line1) {
    pdf.text(employee.address_line1, dimensions.leftMargin, currentY);
    currentY += LINE_HEIGHT;
    if (employee.address_line2) { pdf.text(employee.address_line2, dimensions.leftMargin, currentY); currentY += LINE_HEIGHT; }
    const cityLine = [employee.city, employee.state, employee.postal_code].filter(Boolean).join(', ');
    if (cityLine) { pdf.text(cityLine, dimensions.leftMargin, currentY); currentY += LINE_HEIGHT; }
  }
  currentY += PARAGRAPH_GAP;

  // ── Subject ────────────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Subject: Internship Offer Letter – ${data.position}`, dimensions.leftMargin, currentY);
  currentY += 10;
  pdf.text(`Program: ${programName}`, dimensions.leftMargin, currentY);
  currentY += 10;
  pdf.setFont('helvetica', 'normal');

  // ── Opening paragraph ─────────────────────────────────────────────────────
  pdf.text(`Dear ${employee.full_name},`, dimensions.leftMargin, currentY);
  currentY += SECTION_GAP;
  const opening = `We are pleased to offer you an internship position as ${data.position} in the ${data.department} at ${companyName} under the ${programName}. This offer is valid subject to the terms and conditions set out below.`;
  await writeWrapped(opening);
  currentY += SECTION_GAP;

  // ── Helper for writing key-value detail rows without text overlap ───────────
  const writeDetailRow = async (label: string, value: string) => {
    if (!value) return;
    await checkBreak(LINE_HEIGHT + 2);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${label}: `, dimensions.leftMargin, currentY);
    const labelWidth = pdf.getTextWidth(`${label}: `);
    pdf.setFont('helvetica', 'normal');

    const valLines = value.split('\n');
    for (let i = 0; i < valLines.length; i++) {
      const lineStr = valLines[i].trim();
      if (!lineStr) continue;
      const indentX = i === 0 ? labelWidth : 0;
      const startX = dimensions.leftMargin + indentX;
      const splitLines = pdf.splitTextToSize(lineStr, dimensions.rightMargin - startX);
      for (let j = 0; j < splitLines.length; j++) {
        await checkBreak(LINE_HEIGHT + 2);
        const posX = (i === 0 && j === 0) ? (dimensions.leftMargin + labelWidth) : (dimensions.leftMargin + 20);
        pdf.text(splitLines[j], posX, currentY);
        currentY += LINE_HEIGHT;
      }
    }
    currentY += 2;
  };

  // ── 1. Internship Scope & Duration ────────────────────────────────────────
  await writeSectionHeading('1. Internship Scope & Duration');
  const duration = data.internship_duration || calcDurationMonths(data.joining_date, data.end_date);
  await writeDetailRow('Date of Joining', formatDate(data.joining_date));
  await writeDetailRow('End Date', formatDate(data.end_date));
  await writeDetailRow('Duration', duration);
  currentY += PARAGRAPH_GAP;
  if (data.internship_scope) {
    await writeWrapped(data.internship_scope);
  } else {
    await writeWrapped(
      `The internship is designed to provide hands-on practical experience in ${data.department}. The scope may be revised by the supervisor based on project requirements and intern progress.`
    );
  }
  currentY += SECTION_GAP;

  // ── 2. Internship Program Details ─────────────────────────────────────────
  await writeSectionHeading('2. Internship Program Details');
  await writeWrapped(`Program: ${programName}`);
  if (data.program_batch) await writeWrapped(`Batch: ${data.program_batch}`);
  if (data.program_notes) { currentY += PARAGRAPH_GAP; await writeWrapped(data.program_notes); }
  currentY += SECTION_GAP;

  // ── 3. Position & Reporting ───────────────────────────────────────────────
  await writeSectionHeading('3. Position & Reporting');
  const locTypeStr = data.work_location_type ? (data.work_location_type.charAt(0).toUpperCase() + data.work_location_type.slice(1)) : 'Onsite';

  await writeDetailRow('Intern Title', data.position);
  await writeDetailRow('Department', data.department);
  await writeDetailRow('Supervisor', `${data.supervisor_name || '[Supervisor Name]'}${data.supervisor_title ? ' (' + data.supervisor_title + ')' : ''}`);
  await writeDetailRow('Work Location Type', locTypeStr);
  if (data.work_location_type !== 'remote' && data.work_location) {
    await writeDetailRow('Work Location Address', data.work_location);
  }
  if (data.working_hours_start && data.working_hours_end) {
    await writeWrapped(`Working Hours: ${data.working_hours_start} – ${data.working_hours_end}, ${data.working_days || 'Monday to Friday'}`);
  }
  currentY += SECTION_GAP;

  // ── 4. Duties & Responsibilities ─────────────────────────────────────────
  await writeSectionHeading('4. Duties & Responsibilities');
  if (data.duties_and_responsibilities) {
    await writeWrapped('During the internship, you will be expected to:');
    currentY += PARAGRAPH_GAP;
    const duties = data.duties_and_responsibilities.split('\n').filter(d => d.trim());
    for (const duty of duties) await writeBullet(duty.trim());
  } else {
    await writeWrapped('During the internship, you will be expected to:');
    currentY += PARAGRAPH_GAP;
    const defaultDuties = [
      'Assist the team with project-related tasks as assigned by the supervisor',
      'Participate in team meetings, standups, and knowledge-sharing sessions',
      'Document work progress and submit weekly reports to the supervisor',
      'Adhere to company policies, code of conduct, and professional standards',
      'Any other duties reasonably assigned by the supervisor',
    ];
    for (const d of defaultDuties) await writeBullet(d);
  }
  if (data.learning_objectives) {
    currentY += PARAGRAPH_GAP;
    await writeWrapped('Learning Objectives:');
    currentY += 2;
    const objectives = data.learning_objectives.split('\n').filter(o => o.trim());
    for (const obj of objectives) await writeBullet(obj.trim());
  }
  currentY += SECTION_GAP;

  // ── 5. Compensation & Reimbursements ──────────────────────────────────────
  await writeSectionHeading('5. Compensation & Reimbursements');
  if (!data.is_paid) {
    await writeWrapped(
      'This internship is UNPAID. No salary, stipend, or monetary remuneration will be paid to the intern unless explicitly amended in writing by the company. The primary benefit is professional development, mentorship, and a certificate of completion.'
    );
  } else {
    const currency = data.stipend_currency || 'INR';
    const amount = (data.stipend_amount ?? 0).toLocaleString('en-IN');
    await writeWrapped(`This internship carries a monthly stipend of ${currency} ${amount}, payable at the end of each calendar month.`);
  }
  if (data.reimbursement_details) {
    currentY += PARAGRAPH_GAP;
    await writeWrapped(`Reimbursements: ${data.reimbursement_details}`);
  }
  currentY += SECTION_GAP;

  // ── 6. Code of Conduct & Ethics ────────────────────────────────────────────
  await writeSectionHeading('6. Code of Conduct & Professional Ethics');
  await writeWrapped(
    `As an intern at ${companyName}, you are expected to maintain high standards of professional integrity, punctual attendance, respectful communication, and compliance with all company directives, IT security rules, and workplace policies.`
  );
  currentY += SECTION_GAP;

  // ── 7. Confidentiality & Non-Disclosure ────────────────────────────────────
  if (data.confidentiality_clause !== false) {
    await writeSectionHeading('7. Confidentiality & Non-Disclosure');
    await writeWrapped(INTERN_CONFIDENTIALITY_CLAUSE);
    currentY += SECTION_GAP;
  }

  // ── 8. Intellectual Property Assignment ───────────────────────────────────
  if (data.ip_assignment_clause !== false) {
    await writeSectionHeading('8. Intellectual Property Assignment');
    await writeWrapped(
      data.ip_clause_text ||
      `All source code, designs, algorithms, intellectual property, and documentation produced by the intern during this program shall remain the exclusive property of ${companyName}.`
    );
    currentY += SECTION_GAP;
  }

  // ── 9. Company Assets & Care ─────────────────────────────────────────────
  await writeSectionHeading('9. Company Assets Care & Return');
  await writeWrapped(
    data.asset_clause_text ||
    `The intern is responsible for the care and proper ethical use of all ${companyName}-issued equipment, software access, and data. All physical and digital company assets must be returned immediately upon program exit.`
  );
  currentY += SECTION_GAP;

  // ── 10. Probation & Termination / Notice Period ───────────────────────────
  await writeSectionHeading('10. Termination & Notice Period');
  await writeWrapped(
    `Either party may terminate this internship engagement at any time by providing 7 days written notice. In cases of gross misconduct, breach of confidentiality, or policy violation, ${companyName} reserves the right to terminate the internship immediately without prior notice.`
  );
  currentY += SECTION_GAP;

  // ── 11. Governing Law & Jurisdiction ──────────────────────────────────────
  if (data.jurisdiction) {
    await writeSectionHeading('11. Governing Law & Jurisdiction');
    await writeWrapped(`This internship agreement shall be governed by and construed in accordance with the laws of ${data.jurisdiction}.`);
    currentY += SECTION_GAP;
  }

  // ── 12. Legal Disclaimer & Compliance ─────────────────────────────────────
  await writeSectionHeading('12. Legal Disclaimer & Compliance');
  await writeWrapped(data.legal_disclaimer || INTERN_LEGAL_DISCLAIMER);
  currentY += SECTION_GAP;

  // ── 13. Acceptance of Offer & Side-by-Side Signatures ──────────────────────
  await writeSectionHeading('13. Acceptance of Offer');
  await writeWrapped('Please sign and return a copy of this letter within 3 working days to confirm your acceptance. Failure to do so may result in withdrawal of this offer.');
  currentY += SECTION_GAP;

  await checkBreak(45);
  const leftColX = dimensions.leftMargin;
  const rightColX = dimensions.leftMargin + 95;
  const sigStartY = currentY;

  // Left Column: Accepted by (Intern)
  pdf.setFont('helvetica', 'bold');
  pdf.text('Accepted by (Intern):', leftColX, sigStartY);
  pdf.line(leftColX, sigStartY + 8, leftColX + 70, sigStartY + 8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Name: ${employee.full_name}`, leftColX, sigStartY + 14);
  pdf.text('Date: ___________________', leftColX, sigStartY + 20);

  // Right Column: Issued by Company
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Issued by ${companyName}:`, rightColX, sigStartY);
  pdf.line(rightColX, sigStartY + 8, rightColX + 70, sigStartY + 8);

  let rightY = sigStartY + 14;
  const sigName = data.signatory_name || signatoryName || '';
  const sigDesig = data.signatory_designation || signatoryDesignation || '';
  if (sigName) { pdf.setFont('helvetica', 'bold'); pdf.text(sigName, rightColX, rightY); rightY += 5; }
  if (sigDesig) { pdf.setFont('helvetica', 'normal'); pdf.text(sigDesig, rightColX, rightY); rightY += 5; }
  if (data.signatory_contact) { pdf.setFont('helvetica', 'normal'); pdf.text(data.signatory_contact, rightColX, rightY); rightY += 5; }

  currentY = Math.max(sigStartY + 25, rightY + 5);

  return pdf;
}

// ─── PDF Generator: Intern Experience Certificate ─────────────────────────────

/**
 * Generates a jsPDF instance for an ITWala Academy Internship Experience Certificate.
 * Extends the base experience-certificate template with internship-specific sections
 * (program metadata, projects, skills, rating).
 */
export async function generateInternExperienceCertificatePDF(
  employee: Employee,
  data: InternExperienceCertificateData,
  companySettings: CompanySettings | null,
  signatoryName?: string,
  signatoryDesignation?: string
): Promise<jsPDF> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const dimensions = PDFBrandingUtils.getStandardDimensions();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const companyName = companySettings?.company_name || 'Kdadks';
  const programName = data.program_name || PROGRAM_NAME_DEFAULT;

  const FONT_SIZE = { title: 16, heading: 11, body: 11, small: 9 };
  const LINE_HEIGHT = 7;
  const contentWidth = dimensions.rightMargin - dimensions.leftMargin;

  let contentStartY = dimensions.topMargin;
  let contentEndY = pageHeight - dimensions.bottomMargin;

  if (companySettings) {
    const br = await PDFBrandingUtils.applyBranding(pdf, companySettings, dimensions);
    contentStartY = br.contentStartY;
    contentEndY = br.contentEndY;
  }

  let currentY = contentStartY;

  const addNewPage = async () => {
    pdf.addPage();
    if (companySettings) {
      const br = await PDFBrandingUtils.applyBranding(pdf, companySettings, dimensions);
      contentStartY = br.contentStartY;
      contentEndY = br.contentEndY;
    }
    currentY = contentStartY;
  };

  const checkBreak = async (space: number) => {
    if (currentY + space > contentEndY) await addNewPage();
  };

  const writeWrapped = async (text: string, indent = 0) => {
    const lines = pdf.splitTextToSize(text, contentWidth - indent);
    for (const line of lines) {
      await checkBreak(LINE_HEIGHT);
      pdf.text(line, dimensions.leftMargin + indent, currentY);
      currentY += LINE_HEIGHT;
    }
  };

  const writeVersionFooter = async () => {
    if (data.version_meta) {
      await checkBreak(18);
      currentY += 6;
      pdf.setFontSize(FONT_SIZE.small - 1);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(150, 150, 150);
      const { version, template_version, created_at, approval_status, document_ref } = data.version_meta;
      pdf.text(
        `Doc Ref: ${document_ref ?? '—'} | Version: ${version} | Template: ${template_version} | Status: ${approval_status} | Issued: ${new Date(created_at).toLocaleDateString('en-GB')}`,
        dimensions.leftMargin,
        currentY
      );
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(FONT_SIZE.body);
    }
  };

  // ── Company Header ──────────────────────────────────────────────────────────
  if (!companySettings?.header_image_data) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(companyName, pageWidth / 2, currentY, { align: 'center' });
    currentY += 6;
    if (companySettings?.address_line1) {
      pdf.setFontSize(FONT_SIZE.small);
      pdf.setFont('helvetica', 'normal');
      const addr = [companySettings.address_line1, companySettings.address_line2, companySettings.city, companySettings.state, companySettings.postal_code].filter(Boolean).join(', ');
      pdf.text(addr, pageWidth / 2, currentY, { align: 'center' });
      currentY += 5;
    }
    pdf.setFontSize(FONT_SIZE.small);
    pdf.setFont('helvetica', 'italic');
    pdf.text(programName, pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;
  }

  // ── Certificate Title ──────────────────────────────────────────────────────
  pdf.setFontSize(FONT_SIZE.title);
  pdf.setFont('helvetica', 'bold');
  pdf.text('INTERNSHIP EXPERIENCE CERTIFICATE', pageWidth / 2, currentY, { align: 'center' });
  currentY += 14;

  // ── Issued Date & Reference ────────────────────────────────────────────────
  pdf.setFontSize(FONT_SIZE.body);
  pdf.setFont('helvetica', 'normal');
  const issuedDate = data.issued_date ? formatDate(data.issued_date) : new Date().toLocaleDateString('en-GB');
  pdf.text(`Date: ${issuedDate}`, dimensions.rightMargin, currentY, { align: 'right' });
  currentY += 14;

  // ── To Whom It May Concern ─────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.text('TO WHOM IT MAY CONCERN', dimensions.leftMargin, currentY);
  currentY += LINE_HEIGHT + 4;

  // ── Core Certification Paragraph ───────────────────────────────────────────
  pdf.setFont('helvetica', 'normal');
  const internName = data.employee_name || employee.full_name;
  const periodOfEmployment = data.period_of_employment || calcDurationMonths(data.date_of_joining, data.last_working_date);
  const internType = data.internship_type ? ` (${data.internship_type})` : '';

  const certPara1 = `This is to certify that ${internName} successfully completed an internship${internType} as ${data.designation}${data.department ? ' in the ' + data.department + ' department' : ''} at ${companyName} under the ${programName}${data.program_batch ? ', ' + data.program_batch : ''}.`;
  const certPara2 = `The internship commenced on ${formatDate(data.date_of_joining)} and concluded on ${formatDate(data.last_working_date)}, spanning a period of ${periodOfEmployment}.`;

  await writeWrapped(certPara1);
  currentY += 4;
  await writeWrapped(certPara2);
  currentY += 8;

  // ── Supervisor ────────────────────────────────────────────────────────────
  if (data.supervisor_name) {
    pdf.setFont('helvetica', 'normal');
    await writeWrapped(`The internship was supervised by ${data.supervisor_name}${data.supervisor_title ? ' (' + data.supervisor_title + ')' : ''}.`);
    currentY += 4;
  }

  // ── Projects & Achievements ───────────────────────────────────────────────
  if (data.projects_worked_on) {
    currentY += 4;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Projects & Work Undertaken:', dimensions.leftMargin, currentY);
    currentY += LINE_HEIGHT;
    pdf.setFont('helvetica', 'normal');
    const projects = data.projects_worked_on.split('\n').filter(p => p.trim());
    for (const proj of projects) {
      const bulletLines = pdf.splitTextToSize(`• ${proj.trim()}`, contentWidth - 5);
      for (const line of bulletLines) {
        await checkBreak(LINE_HEIGHT);
        pdf.text(line, dimensions.leftMargin + 5, currentY);
        currentY += LINE_HEIGHT;
      }
    }
    currentY += 4;
  }

  // ── Key Achievements ─────────────────────────────────────────────────────
  if (data.key_achievements) {
    currentY += 2;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Key Achievements:', dimensions.leftMargin, currentY);
    currentY += LINE_HEIGHT;
    pdf.setFont('helvetica', 'normal');
    await writeWrapped(data.key_achievements, 5);
    currentY += 4;
  }

  // ── Skills Acquired ───────────────────────────────────────────────────────
  if (data.skills_acquired) {
    currentY += 2;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Skills Acquired:', dimensions.leftMargin, currentY);
    currentY += LINE_HEIGHT;
    pdf.setFont('helvetica', 'normal');
    await writeWrapped(data.skills_acquired, 5);
    currentY += 4;
  }

  // ── Performance & Conduct ─────────────────────────────────────────────────
  if (data.performance_note) {
    currentY += 2;
    await writeWrapped(data.performance_note);
    currentY += 4;
  }
  if (data.conduct_note) {
    await writeWrapped(data.conduct_note);
    currentY += 4;
  }

  // ── Overall Rating ────────────────────────────────────────────────────────
  if (data.overall_rating) {
    const ratingText = {
      excellent: 'excellent',
      good: 'good',
      satisfactory: 'satisfactory',
    }[data.overall_rating];
    await writeWrapped(
      `Overall, ${employee.first_name}'s performance during the internship is assessed as ${ratingText.toUpperCase()}.`
    );
    currentY += 4;
  }

  // ── Compensation Reference ────────────────────────────────────────────────
  if (data.was_paid === false || !data.was_paid) {
    await writeWrapped('This was an unpaid internship, and no monetary compensation was provided during the tenure.');
  } else if (data.stipend_details) {
    await writeWrapped(`Compensation: ${data.stipend_details}`);
  }
  currentY += 4;

  // ── Closing ───────────────────────────────────────────────────────────────
  const closingText = `We wish ${employee.first_name} all the best in their future academic and professional endeavors. This certificate is issued in good faith and without any prejudice.`;
  await writeWrapped(closingText);
  currentY += 14;

  // ── Signature Section ─────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'normal');
  pdf.text(`For ${companyName}`, dimensions.leftMargin, currentY);
  currentY += 18;

  const sigName = data.signatory_name || signatoryName || '';
  const sigDesig = data.signatory_designation || signatoryDesignation || '';
  if (sigName) { pdf.setFont('helvetica', 'bold'); pdf.text(sigName, dimensions.leftMargin, currentY); currentY += 5; }
  if (sigDesig) { pdf.setFont('helvetica', 'normal'); pdf.text(sigDesig, dimensions.leftMargin, currentY); currentY += 5; }
  if (data.contact_details) { pdf.text(data.contact_details, dimensions.leftMargin, currentY); currentY += 5; }

  // ── Legal Disclaimer ──────────────────────────────────────────────────────
  currentY += 8;
  pdf.setFontSize(FONT_SIZE.small);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 100, 100);
  await writeWrapped(data.legal_disclaimer || 'This certificate is issued exclusively for the purpose of verifying internship tenure at ITWala Academy / Kdadks and shall not be construed as a certificate of permanent employment.');
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);

  return pdf;
}

// ─── Default Form-Data Factories ─────────────────────────────────────────────

/** Returns sensible default values for a new Intern Offer Letter form */
export function getDefaultInternOfferLetterData(
  employee: Employee,
  authorName = 'HR Admin'
): InternOfferLetterData {
  const today = new Date().toISOString().split('T')[0];
  const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return {
    position: employee.designation || 'Intern',
    department: employee.department || '',
    offer_date: today,
    joining_date: employee.date_of_joining || today,
    end_date: threeMonthsLater,
    internship_duration: '3 months',
    program_name: PROGRAM_NAME_DEFAULT,
    is_paid: false,
    stipend_currency: 'INR',
    working_hours_start: '9:30 AM',
    working_hours_end: '6:30 PM',
    working_days: 'Monday to Friday',
    confidentiality_clause: true,
    ip_assignment_clause: true,
    version_meta: createVersionMeta(authorName),
  };
}

/** Returns sensible default values for a new Intern Experience Certificate form */
export function getDefaultInternExperienceCertData(
  employee: Employee,
  authorName = 'HR Admin'
): InternExperienceCertificateData {
  const today = new Date().toISOString().split('T')[0];
  return {
    employee_name: employee.full_name,
    designation: employee.designation || 'Intern',
    department: employee.department,
    date_of_joining: employee.date_of_joining || today,
    last_working_date: employee.date_of_leaving || today,
    program_name: PROGRAM_NAME_DEFAULT,
    was_paid: false,
    issued_date: today,
    version_meta: createVersionMeta(authorName),
  };
}
