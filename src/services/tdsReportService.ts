// TDS Report Service
import { supabase } from '../config/supabase';

export interface TDSReportEntry {
  employee_id: string;
  employee_number: string;
  employee_name: string;
  pan_number?: string;
  source_type: 'salary_slip' | 'settlement';
  source_id: string;
  month: number;
  year: number;
  date: string;
  gross_amount: number;
  tds_amount: number;
  remarks?: string;
}

export interface TDSReportSummary {
  employee_id: string;
  employee_number: string;
  employee_name: string;
  pan_number?: string;
  total_gross: number;
  total_tds: number;
  entry_count: number;
  entries: TDSReportEntry[];
}

export interface TDSReportFilters {
  start_date: string;
  end_date: string;
  employee_id?: string;
  financial_year?: string;
  company_settings_id?: string;
}

class TDSReportService {
  /**
   * Get TDS report for date range
   */
  async getTDSReport(filters: TDSReportFilters): Promise<TDSReportSummary[]> {
    const entries: TDSReportEntry[] = [];

    try {
      // 1. Fetch TDS from Salary Slips with proper employee join
      // Build date filter - convert YYYY-MM format for salary slips
      const startYear = parseInt(filters.start_date.split('-')[0]);
      const startMonth = parseInt(filters.start_date.split('-')[1]);
      const endYear = parseInt(filters.end_date.split('-')[0]);
      const endMonth = parseInt(filters.end_date.split('-')[1]);

      // Fetch salary slips
      let salaryQuery = supabase
        .from('salary_slips')
        .select('*')
        .gt('tds', 0);

      if (filters.employee_id) {
        salaryQuery = salaryQuery.eq('employee_id', filters.employee_id);
      }

      const { data: salarySlips, error: salaryError } = await salaryQuery;

      if (salaryError) {
        console.error('Error fetching salary slips:', salaryError);
      }

      if (salarySlips) {
        // Filter by date range manually (more reliable than DB filtering on year/month)
        const filteredSlips = salarySlips.filter(slip => {
          const slipDate = slip.salary_year * 100 + slip.salary_month;
          const startDate = startYear * 100 + startMonth;
          const endDate = endYear * 100 + endMonth;
          return slipDate >= startDate && slipDate <= endDate;
        });

        // Fetch employee details for each slip
        const employeeIds = [...new Set(filteredSlips.map(s => s.employee_id))].filter(id => id);

        if (employeeIds.length > 0) {
          let empQuery = supabase
            .from('employees')
            .select('id, employee_number, full_name, pan_number, company_settings_id')
            .in('id', employeeIds);
          if (filters.company_settings_id) {
            empQuery = empQuery.or(`company_settings_id.eq.${filters.company_settings_id},company_settings_id.is.null`);
          }
          const { data: employees, error: empError } = await empQuery;

          if (empError) {
            console.error('Error fetching employees:', empError);
          }

          const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);

          for (const slip of filteredSlips) {
            const employee = employeeMap.get(slip.employee_id);
            if (employee) {
              entries.push({
                employee_id: slip.employee_id,
                employee_number: employee.employee_number,
                employee_name: employee.full_name,
                pan_number: employee.pan_number,
                source_type: 'salary_slip',
                source_id: slip.id,
                month: slip.salary_month,
                year: slip.salary_year,
                date: new Date(slip.salary_year, slip.salary_month - 1, 1).toISOString().split('T')[0],
                gross_amount: slip.gross_salary || 0,
                tds_amount: slip.tds || 0,
                remarks: `Salary Slip - ${this.getMonthName(slip.salary_month)} ${slip.salary_year}`
              });
            } else {
              // Log warning if employee not found
              console.warn(`Employee not found for salary slip ${slip.id}, employee_id: ${slip.employee_id}`);
            }
          }
        }
      }

      // 2. Fetch TDS from Full & Final Settlements
      let settlementQuery = supabase
        .from('full_final_settlements')
        .select('*')
        .gte('relieving_date', filters.start_date)
        .lte('relieving_date', filters.end_date)
        .gt('tax_deduction', 0);

      if (filters.employee_id) {
        settlementQuery = settlementQuery.eq('employee_id', filters.employee_id);
      }

      const { data: settlements, error: settlementError } = await settlementQuery;

      if (settlementError) {
        console.error('Error fetching settlements:', settlementError);
      }

      if (settlements) {
        // Fetch employee details for settlements
        const settlementEmpIds = [...new Set(settlements.map(s => s.employee_id))].filter(id => id);

        if (settlementEmpIds.length > 0) {
          const { data: settlementEmployees, error: settlementEmpError } = await supabase
            .from('employees')
            .select('id, employee_number, full_name, pan_number')
            .in('id', settlementEmpIds);

          if (settlementEmpError) {
            console.error('Error fetching settlement employees:', settlementEmpError);
          }

          const settlementEmpMap = new Map(settlementEmployees?.map(e => [e.id, e]) || []);

          for (const settlement of settlements) {
            const employee = settlementEmpMap.get(settlement.employee_id);

            if (employee) {
              entries.push({
                employee_id: settlement.employee_id,
                employee_number: employee.employee_number,
                employee_name: employee.full_name,
                pan_number: employee.pan_number,
                source_type: 'settlement',
                source_id: settlement.id,
                month: settlement.settlement_month,
                year: settlement.settlement_year,
                date: settlement.relieving_date,
                gross_amount: settlement.gross_settlement || 0,
                tds_amount: settlement.tax_deduction || 0,
                remarks: `F&F Settlement - ${new Date(settlement.relieving_date).toLocaleDateString('en-IN')}`
              });
            } else {
              // Log warning if employee not found - use denormalized data as fallback
              console.warn(`Employee not found for settlement ${settlement.id}, employee_id: ${settlement.employee_id}. Using denormalized data.`);
              entries.push({
                employee_id: settlement.employee_id,
                employee_number: settlement.employee_number,
                employee_name: settlement.employee_name,
                pan_number: undefined,
                source_type: 'settlement',
                source_id: settlement.id,
                month: settlement.settlement_month,
                year: settlement.settlement_year,
                date: settlement.relieving_date,
                gross_amount: settlement.gross_settlement || 0,
                tds_amount: settlement.tax_deduction || 0,
                remarks: `F&F Settlement - ${new Date(settlement.relieving_date).toLocaleDateString('en-IN')} (Employee data missing)`
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in getTDSReport:', error);
      throw error;
    }

    // 3. Group by employee and calculate totals
    const summaryMap = new Map<string, TDSReportSummary>();

    for (const entry of entries) {
      if (!summaryMap.has(entry.employee_id)) {
        summaryMap.set(entry.employee_id, {
          employee_id: entry.employee_id,
          employee_number: entry.employee_number,
          employee_name: entry.employee_name,
          pan_number: entry.pan_number,
          total_gross: 0,
          total_tds: 0,
          entry_count: 0,
          entries: []
        });
      }

      const summary = summaryMap.get(entry.employee_id)!;
      summary.total_gross += entry.gross_amount;
      summary.total_tds += entry.tds_amount;
      summary.entry_count += 1;
      summary.entries.push(entry);
    }

    // Convert map to array and sort by employee name
    const summaries = Array.from(summaryMap.values()).sort((a, b) =>
      a.employee_name.localeCompare(b.employee_name)
    );

    return summaries;
  }

  /**
   * Get TDS report for a specific employee
   */
  async getEmployeeTDSReport(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<TDSReportSummary | null> {
    const summaries = await this.getTDSReport({
      start_date: startDate,
      end_date: endDate,
      employee_id: employeeId
    });

    return summaries.length > 0 ? summaries[0] : null;
  }

  /**
   * Get TDS report for financial year
   */
  async getTDSReportForFinancialYear(financialYear: string): Promise<TDSReportSummary[]> {
    // Financial year format: "2024-25"
    const [startYear, endYear] = financialYear.split('-').map(y => parseInt(y.length === 2 ? `20${y}` : y));

    const startDate = `${startYear}-04-01`;
    const endDate = `${endYear}-03-31`;

    return this.getTDSReport({
      start_date: startDate,
      end_date: endDate,
      financial_year: financialYear
    });
  }

  /**
   * Get TDS statistics for a date range
   */
  async getTDSStats(startDate: string, endDate: string): Promise<{
    total_employees: number;
    total_tds: number;
    total_gross: number;
    average_tds_per_employee: number;
    from_salary_slips: number;
    from_settlements: number;
  }> {
    const summaries = await this.getTDSReport({
      start_date: startDate,
      end_date: endDate
    });

    const totalEmployees = summaries.length;
    const totalTDS = summaries.reduce((sum, s) => sum + s.total_tds, 0);
    const totalGross = summaries.reduce((sum, s) => sum + s.total_gross, 0);

    let fromSalarySlips = 0;
    let fromSettlements = 0;

    summaries.forEach(summary => {
      summary.entries.forEach(entry => {
        if (entry.source_type === 'salary_slip') {
          fromSalarySlips += entry.tds_amount;
        } else {
          fromSettlements += entry.tds_amount;
        }
      });
    });

    return {
      total_employees: totalEmployees,
      total_tds: totalTDS,
      total_gross: totalGross,
      average_tds_per_employee: totalEmployees > 0 ? totalTDS / totalEmployees : 0,
      from_salary_slips: fromSalarySlips,
      from_settlements: fromSettlements
    };
  }

  /**
   * Export TDS report to CSV format
   */
  exportToCSV(summaries: TDSReportSummary[]): string {
    const headers = [
      'Employee Number',
      'Employee Name',
      'PAN Number',
      'Date',
      'Source Type',
      'Month',
      'Year',
      'Gross Amount',
      'TDS Amount',
      'Remarks'
    ].join(',');

    const rows: string[] = [headers];

    summaries.forEach(summary => {
      summary.entries.forEach(entry => {
        rows.push([
          entry.employee_number,
          `"${entry.employee_name}"`,
          entry.pan_number || 'N/A',
          entry.date,
          entry.source_type,
          entry.month.toString(),
          entry.year.toString(),
          entry.gross_amount.toFixed(2),
          entry.tds_amount.toFixed(2),
          `"${entry.remarks || ''}"`
        ].join(','));
      });
    });

    return rows.join('\n');
  }

  /**
   * Helper function to get month name
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || '';
  }

  /**
   * Get current financial year
   */
  getCurrentFinancialYear(): string {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    if (month >= 4) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  /**
   * Diagnostic: check how many salary slips exist and how many have TDS > 0
   */
  async getDiagnostics(startDate: string, endDate: string): Promise<{
    total_salary_slips: number;
    slips_with_tds: number;
    total_settlements: number;
    settlements_with_tds: number;
    employees_with_slips: number;
    sample_slip?: { month: number; year: number; gross: number; tds: number; employee_id: string };
  }> {
    const startYear = parseInt(startDate.split('-')[0]);
    const startMonth = parseInt(startDate.split('-')[1]);
    const endYear = parseInt(endDate.split('-')[0]);
    const endMonth = parseInt(endDate.split('-')[1]);

    const { data: allSlips } = await supabase
      .from('salary_slips')
      .select('id, employee_id, salary_month, salary_year, gross_salary, tds');

    const filtered = (allSlips || []).filter(slip => {
      const slipDate = slip.salary_year * 100 + slip.salary_month;
      return slipDate >= startYear * 100 + startMonth && slipDate <= endYear * 100 + endMonth;
    });

    const slipsWithTds = filtered.filter(s => (s.tds || 0) > 0);
    const uniqueEmployees = new Set(filtered.map(s => s.employee_id)).size;

    const { data: settlements } = await supabase
      .from('full_final_settlements')
      .select('id, tax_deduction')
      .gte('relieving_date', startDate)
      .lte('relieving_date', endDate);

    const settlementsWithTds = (settlements || []).filter(s => (s.tax_deduction || 0) > 0);

    const sample = filtered[0];

    return {
      total_salary_slips: filtered.length,
      slips_with_tds: slipsWithTds.length,
      total_settlements: (settlements || []).length,
      settlements_with_tds: settlementsWithTds.length,
      employees_with_slips: uniqueEmployees,
      sample_slip: sample
        ? { month: sample.salary_month, year: sample.salary_year, gross: sample.gross_salary, tds: sample.tds || 0, employee_id: sample.employee_id }
        : undefined,
    };
  }
}

export const tdsReportService = new TDSReportService();
