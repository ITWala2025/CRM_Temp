import jsPDF from 'jspdf';
import type { Employee, SalarySlip } from '../types/employee';
import type { CompanySettings } from '../types/invoice';
import { PDFBrandingUtils } from './pdfBrandingUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export async function generateSalarySlipPDF(
  employee: Employee,
  salarySlip: SalarySlip,
  companySettings?: CompanySettings
): Promise<jsPDF> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const dimensions = PDFBrandingUtils.getStandardDimensions();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let currentY = dimensions.topMargin;
  let contentEndY = pageHeight - dimensions.bottomMargin;

  // Apply branding if available
  if (companySettings) {
    const brandingResult = await PDFBrandingUtils.applyBranding(pdf, companySettings, dimensions);
    currentY = brandingResult.contentStartY;
    contentEndY = brandingResult.contentEndY;
  }

  // Helper function to check if new page is needed
  const checkPageBreak = async (spaceNeeded: number) => {
    if (currentY + spaceNeeded > contentEndY) {
      pdf.addPage();

      // Apply branding to new page
      if (companySettings) {
        const brandingResult = await PDFBrandingUtils.applyBranding(pdf, companySettings, dimensions);
        currentY = brandingResult.contentStartY;
        contentEndY = brandingResult.contentEndY;
      } else {
        currentY = dimensions.topMargin;
        contentEndY = pageHeight - dimensions.bottomMargin;
      }

      return true;
    }
    return false;
  };

  // Document Title
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SALARY SLIP', pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
  currentY += 8;

  // Month and Year
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const monthYear = `${MONTH_NAMES[salarySlip.salary_month - 1]} ${salarySlip.salary_year}`;
  pdf.text(monthYear, pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
  currentY += 6;

  // Financial Year
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Financial Year: ${salarySlip.financial_year}`, pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
  currentY += 10;

  // Draw a line
  pdf.setLineWidth(0.5);
  pdf.line(dimensions.leftMargin, currentY, dimensions.rightMargin, currentY);
  currentY += 8;

  // Employee Information Section
  await checkPageBreak(35);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('EMPLOYEE INFORMATION', dimensions.leftMargin, currentY);
  currentY += 6;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');

  const employeeInfo = [
    ['Employee Name:', employee.full_name, 'Employee No:', employee.employee_number],
    ['Designation:', employee.designation, 'Department:', employee.department || '-'],
    ['PAN:', employee.pan_number || '-', 'UAN:', employee.uan_number || '-'],
    ['Date of Joining:', new Date(employee.date_of_joining).toLocaleDateString('en-GB'), '', '']
  ];

  employeeInfo.forEach(([label1, value1, label2, value2]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label1, dimensions.leftMargin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value1, dimensions.leftMargin + 35, currentY);

    if (label2) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label2, dimensions.leftMargin + 105, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(value2, dimensions.leftMargin + 140, currentY);
    }

    currentY += 5;
  });

  currentY += 3;

  // Attendance Information
  await checkPageBreak(20);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ATTENDANCE', dimensions.leftMargin, currentY);
  currentY += 6;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  const attendanceInfo = [
    ['Working Days:', salarySlip.working_days.toString(), 'Paid Days:', salarySlip.paid_days.toString()],
    ['LOP Days:', salarySlip.lop_days.toString(), 'Leaves Taken:', salarySlip.leaves_taken.toString()]
  ];

  attendanceInfo.forEach(([label1, value1, label2, value2]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label1, dimensions.leftMargin, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value1, dimensions.leftMargin + 35, currentY);

    pdf.setFont('helvetica', 'bold');
    pdf.text(label2, dimensions.leftMargin + 105, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value2, dimensions.leftMargin + 140, currentY);

    currentY += 5;
  });

  currentY += 5;

  // Draw a line
  pdf.line(dimensions.leftMargin, currentY, dimensions.rightMargin, currentY);
  currentY += 8;

  // Earnings and Deductions Table
  await checkPageBreak(70);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');

  // Table Headers - adjusted column positions to fit within page margins
  const pageWidth = pdf.internal.pageSize.getWidth();
  const tableWidth = dimensions.rightMargin - dimensions.leftMargin;
  const colWidth = tableWidth / 2 - 5; // Half width minus gap
  
  const col1X = dimensions.leftMargin;  // Earnings label
  const col2X = dimensions.leftMargin + colWidth - 10;  // Earnings amount (right-aligned)
  const col3X = dimensions.leftMargin + colWidth + 10;  // Deductions label
  const col4X = dimensions.rightMargin - 5;  // Deductions amount (right-aligned)

  pdf.text('EARNINGS', col1X, currentY);
  pdf.text('AMOUNT (₹)', col2X - 15, currentY, { align: 'right' });
  pdf.text('DEDUCTIONS', col3X, currentY);
  pdf.text('AMOUNT (₹)', col4X, currentY, { align: 'right' });
  currentY += 2;

  // Underline headers
  pdf.setLineWidth(0.3);
  pdf.line(col1X, currentY, col1X + colWidth - 5, currentY);
  pdf.line(col3X, currentY, dimensions.rightMargin, currentY);
  currentY += 5;

  // Earnings and Deductions Data
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);

  const earningsData = [
    ['Basic Salary', salarySlip.basic_salary],
    ['HRA', salarySlip.hra],
    ['Special Allowance', salarySlip.special_allowance],
    ['Transport Allowance', salarySlip.transport_allowance],
    ['Medical Allowance', salarySlip.medical_allowance],
    ['Other Allowances', salarySlip.other_allowances],
    ['Bonus', salarySlip.bonus],
    ['Overtime', salarySlip.overtime]
  ];

  const deductionsData = [
    ['Provident Fund', salarySlip.provident_fund],
    ['Professional Tax', salarySlip.professional_tax],
    ['ESIC', salarySlip.esic],
    ['TDS (Income Tax)', salarySlip.tds],
    ['Loan Repayment', salarySlip.loan_repayment],
    ['Other Deductions', salarySlip.other_deductions],
    ['', 0],
    ['', 0]
  ];

  const maxRows = Math.max(earningsData.length, deductionsData.length);

  for (let i = 0; i < maxRows; i++) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    // Earnings
    if (i < earningsData.length && Number(earningsData[i][1]) > 0) {
      pdf.text(String(earningsData[i][0]), col1X, currentY);
      pdf.text(Number(earningsData[i][1]).toLocaleString('en-IN'), col2X - 5, currentY, { align: 'right' });
    }

    // Deductions
    if (i < deductionsData.length && Number(deductionsData[i][1]) > 0) {
      pdf.text(String(deductionsData[i][0]), col3X, currentY);
      pdf.text(Number(deductionsData[i][1]).toLocaleString('en-IN'), col4X, currentY, { align: 'right' });
    }

    currentY += 5;
  }

  currentY += 2;

  // Draw line before totals
  pdf.setLineWidth(0.5);
  pdf.line(col1X, currentY, col1X + colWidth - 5, currentY);
  pdf.line(col3X, currentY, dimensions.rightMargin, currentY);
  currentY += 5;

  // Totals
  await checkPageBreak(15);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('GROSS SALARY', col1X, currentY);
  pdf.text(salarySlip.gross_salary.toLocaleString('en-IN'), col2X - 5, currentY, { align: 'right' });

  pdf.text('TOTAL DEDUCTIONS', col3X, currentY);
  pdf.text(salarySlip.total_deductions.toLocaleString('en-IN'), col4X, currentY, { align: 'right' });
  currentY += 7;

  // Double line before net salary
  pdf.setLineWidth(0.8);
  pdf.line(dimensions.leftMargin, currentY, dimensions.rightMargin, currentY);
  currentY += 6;

  // Net Salary
  await checkPageBreak(20);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('NET SALARY PAYABLE', dimensions.leftMargin, currentY);
  pdf.text(`₹ ${salarySlip.net_salary.toLocaleString('en-IN')}`, dimensions.rightMargin - 10, currentY, { align: 'right' });
  currentY += 8;

  pdf.setLineWidth(0.8);
  pdf.line(dimensions.leftMargin, currentY, dimensions.rightMargin, currentY);
  currentY += 6;

  // Net Salary in Words
  await checkPageBreak(10);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'italic');
  const netInWords = numberToWords(salarySlip.net_salary);
  pdf.text(`In Words: ${netInWords} Rupees Only`, dimensions.leftMargin, currentY);
  currentY += 10;

  // Payment Information (if paid)
  if (salarySlip.status === 'paid' && salarySlip.payment_date) {
    await checkPageBreak(25);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PAYMENT INFORMATION', dimensions.leftMargin, currentY);
    currentY += 6;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Payment Date: ${new Date(salarySlip.payment_date).toLocaleDateString('en-GB')}`, dimensions.leftMargin, currentY);
    currentY += 5;

    if (salarySlip.payment_mode) {
      await checkPageBreak(6);
      pdf.text(`Payment Mode: ${salarySlip.payment_mode}`, dimensions.leftMargin, currentY);
      currentY += 5;
    }

    if (salarySlip.payment_reference) {
      await checkPageBreak(6);
      pdf.text(`Reference: ${salarySlip.payment_reference}`, dimensions.leftMargin, currentY);
      currentY += 5;
    }

    currentY += 3;
  }

  // Bank Details (if available)
  if (employee.bank_name) {
    await checkPageBreak(25);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('BANK DETAILS', dimensions.leftMargin, currentY);
    currentY += 6;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Bank Name: ${employee.bank_name}`, dimensions.leftMargin, currentY);
    currentY += 5;

    if (employee.bank_account_number) {
      await checkPageBreak(6);
      const maskedAccount = maskAccountNumber(employee.bank_account_number);
      pdf.text(`Account Number: ${maskedAccount}`, dimensions.leftMargin, currentY);
      currentY += 5;
    }

    if (employee.bank_ifsc_code) {
      await checkPageBreak(6);
      pdf.text(`IFSC Code: ${employee.bank_ifsc_code}`, dimensions.leftMargin, currentY);
      currentY += 5;
    }

    currentY += 3;
  }

  // Footer disclaimer - positioned above footer image
  const disclaimerHeight = 15;

  // Calculate where disclaimer should start
  let disclaimerY = currentY + 8;

  // If content is too close to footer, position disclaimer just above footer
  if (disclaimerY + disclaimerHeight > contentEndY) {
    disclaimerY = contentEndY - disclaimerHeight;
  }

  // Draw separator line before disclaimer
  pdf.setLineWidth(0.2);
  pdf.setDrawColor(150, 150, 150);
  pdf.line(dimensions.leftMargin + 30, disclaimerY, dimensions.rightMargin - 30, disclaimerY);
  disclaimerY += 5;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 100, 100);
  pdf.text('This is a computer-generated salary slip and does not require a signature.',
    pdf.internal.pageSize.getWidth() / 2, disclaimerY, { align: 'center' });
  disclaimerY += 4;
  pdf.text('For any discrepancies, please contact the HR department.',
    pdf.internal.pageSize.getWidth() / 2, disclaimerY, { align: 'center' });

  // Reset colors
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);

  return pdf;
}

/**
 * Mask account number showing only last 4 digits
 */
function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  const lastFour = accountNumber.slice(-4);
  const masked = 'X'.repeat(accountNumber.length - 4);
  return masked + lastFour;
}

/**
 * Convert number to words (Indian numbering system)
 */
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function convertLessThanThousand(n: number): string {
    if (n === 0) return '';

    if (n < 10) return ones[n];

    if (n < 20) return teens[n - 10];

    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    }

    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
  }

  if (num < 1000) {
    return convertLessThanThousand(num);
  }

  // Indian numbering system: ones, thousands, lakhs, crores
  let result = '';
  let crores = Math.floor(num / 10000000);
  num %= 10000000;

  let lakhs = Math.floor(num / 100000);
  num %= 100000;

  let thousands = Math.floor(num / 1000);
  num %= 1000;

  if (crores > 0) {
    result += convertLessThanThousand(crores) + ' Crore ';
  }

  if (lakhs > 0) {
    result += convertLessThanThousand(lakhs) + ' Lakh ';
  }

  if (thousands > 0) {
    result += convertLessThanThousand(thousands) + ' Thousand ';
  }

  if (num > 0) {
    result += convertLessThanThousand(num);
  }

  return result.trim();
}

export default { generateSalarySlipPDF };
