import { PolicyTemplate, PolicyJurisdiction, PolicyCategory } from '../types/policy';

/**
 * Prefilled Standard HR Policies & SOP Templates by Law Jurisdiction
 */
export const JURISDICTION_POLICY_TEMPLATES: PolicyTemplate[] = [
  // ==========================================
  // INDIA (IN) TEMPLATES
  // ==========================================
  {
    id: 'in-posh-policy',
    title: 'Prevention of Sexual Harassment (POSH) Policy',
    category: 'policy',
    policy_type: 'posh_anti_harassment',
    jurisdiction: 'IN',
    jurisdiction_name: 'India',
    suggested_code: 'POL-IN-POSH-001',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Compliant with the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013.',
    sections: [
      {
        section_number: '1.0',
        title: 'Objective & Scope',
        content: 'This policy is framed in compliance with the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013 ("POSH Act"). It applies to all employees, contractors, interns, and visitors across all offices and workplace-related events of the company in India.'
      },
      {
        section_number: '2.0',
        title: 'Definition of Sexual Harassment',
        content: 'Sexual harassment includes any one or more of the following unwelcome acts or behavior: physical contact and advances, a demand or request for sexual favors, making sexually colored remarks, showing pornography, or any other unwelcome physical, verbal, or non-verbal conduct of sexual nature.'
      },
      {
        section_number: '3.0',
        title: 'Internal Complaints Committee (ICC)',
        content: 'The company has constituted an Internal Complaints Committee (ICC) headed by a senior woman employee (Presiding Officer) with minimum 50% women members and an independent external member experienced in social work or legal matters. Complaints must be lodged within 3 months of the incident.'
      },
      {
        section_number: '4.0',
        title: 'Redressal & Inquiry Procedure',
        content: 'Upon receiving a complaint, the ICC shall initiate conciliation if requested by the aggrieved woman, or proceed with an inquiry. The inquiry must be completed within 90 days. During the inquiry, interim relief including transfer or up to 3 months paid leave may be granted.'
      },
      {
        section_number: '5.0',
        title: 'Confidentiality & Non-Retaliation',
        content: 'The identity and addresses of the aggrieved woman, respondent, and witnesses shall strictly remain confidential. Any retaliation against an individual for reporting or participating in an inquiry is strictly prohibited and subject to immediate termination.'
      }
    ]
  },
  {
    id: 'in-working-hours-overtime',
    title: 'Working Hours, Attendance & Overtime Policy',
    category: 'policy',
    policy_type: 'working_hours_attendance',
    jurisdiction: 'IN',
    jurisdiction_name: 'India',
    suggested_code: 'POL-IN-WHR-002',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Defines standard working hours, attendance tracking, core hours, break intervals, and overtime compensation under relevant State Shops & Establishments Acts.',
    sections: [
      {
        section_number: '1.0',
        title: 'Standard Working Hours',
        content: 'The standard working schedule consists of 48 hours per week (8 hours per day, 6 days a week or 9 hours per day for 5-day work week) in accordance with the applicable State Shops and Commercial Establishments Act. Core business hours are 9:30 AM to 6:30 PM IST.'
      },
      {
        section_number: '2.0',
        title: 'Attendance & Meal Intervals',
        content: 'Employees are required to mark attendance daily via the employee portal. A mandatory rest interval of at least 45 to 60 minutes for lunch must be taken. No employee shall work continuously for more than 5 hours without a rest break.'
      },
      {
        section_number: '3.0',
        title: 'Overtime Compensation',
        content: 'Work performed beyond standard daily hours requires prior written manager approval. Eligible employees working overtime shall be compensated at twice the ordinary rate of wages (200%) per statutory guidelines.'
      },
      {
        section_number: '4.0',
        title: 'Late Arrival & Regularization',
        content: 'Arrival beyond 15 minutes of scheduled start time requires submission of an attendance regularization request. Three unapproved late arrivals in a calendar month will result in a deduction of half a day of leave.'
      }
    ]
  },
  {
    id: 'in-maternity-leave-policy',
    title: 'Maternity, Paternity & Statutory Leave Policy',
    category: 'policy',
    policy_type: 'maternity_statutory_leave',
    jurisdiction: 'IN',
    jurisdiction_name: 'India',
    suggested_code: 'POL-IN-MLP-003',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Governed by the Maternity Benefit (Amendment) Act, 2017, statutory earned leave, sick leave, and paternity leave regulations.',
    sections: [
      {
        section_number: '1.0',
        title: 'Maternity Benefit',
        content: 'Eligible female employees who have worked for at least 80 days in the preceding 12 months are entitled to 26 weeks of fully paid maternity leave for up to two surviving children (12 weeks for third or subsequent child). Up to 8 weeks can be availed prior to expected delivery.'
      },
      {
        section_number: '2.0',
        title: 'Adoption & Commissioning Mothers',
        content: 'Female employees legally adopting a child under 3 months of age or commissioning mothers are entitled to 12 weeks of fully paid maternity leave from the date the child is handed over.'
      },
      {
        section_number: '3.0',
        title: 'Paternity & Parental Support',
        content: 'Male employees are entitled to 15 continuous days of paid paternity leave within 6 months of child birth or adoption. Crèche facility access is provided for establishments with 50 or more employees.'
      },
      {
        section_number: '4.0',
        title: 'Earned & Sick Leaves',
        content: 'Employees accrue earned leave (1.25 to 1.5 days per month worked) up to 18-30 days per annum depending on state rules. Up to 12 days of sick leave per annum are granted with medical certificate required for 3+ consecutive days.'
      }
    ]
  },

  // ==========================================
  // IRELAND (IE) TEMPLATES
  // ==========================================
  {
    id: 'ie-gdpr-data-privacy',
    title: 'Data Protection & GDPR Compliance Policy',
    category: 'policy',
    policy_type: 'data_privacy_gdpr',
    jurisdiction: 'IE',
    jurisdiction_name: 'Ireland',
    suggested_code: 'POL-IE-GDPR-001',
    target_audience: 'All Employees',
    enforcement_level: 'Strict Compliance',
    summary: 'Compliant with the General Data Protection Regulation (GDPR) (EU 2016/679) and the Data Protection Act 2018 of Ireland.',
    sections: [
      {
        section_number: '1.0',
        title: 'Data Protection Principles',
        content: 'All personal data processed by the company must be processed lawfully, fairly, and transparently; collected for specified, explicit, and legitimate purposes; adequate, relevant, and limited to what is necessary; accurate and kept up to date; and stored securely.'
      },
      {
        section_number: '2.0',
        title: 'Data Subject Rights',
        content: 'Individuals have the Right of Access, Right to Rectification, Right to Erasure ("Right to be Forgotten"), Right to Restrict Processing, Right to Data Portability, and Right to Object. Subject Access Requests (SARs) must be fulfilled without delay and within 30 calendar days.'
      },
      {
        section_number: '3.0',
        title: 'Data Breach Notification',
        content: 'Any actual or suspected personal data breach must be reported immediately to the Data Protection Officer (DPO). The company is legally mandated to report qualifying breaches to the Data Protection Commission (DPC) within 72 hours of becoming aware.'
      },
      {
        section_number: '4.0',
        title: 'International Data Transfers',
        content: 'Transfers of personal data outside the European Economic Area (EEA) may only occur subject to EU Standard Contractual Clauses (SCCs), adequacy decisions, or explicit data transfer agreements.'
      }
    ]
  },
  {
    id: 'ie-working-time-policy',
    title: 'Working Time & Rest Periods Policy',
    category: 'policy',
    policy_type: 'working_hours_attendance',
    jurisdiction: 'IE',
    jurisdiction_name: 'Ireland',
    suggested_code: 'POL-IE-WTA-002',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Compliant with the Organisation of Working Time Act 1997, statutory rest intervals, Sunday premiums, and 20 days statutory annual leave.',
    sections: [
      {
        section_number: '1.0',
        title: 'Maximum Weekly Working Hours',
        content: 'Under the Organisation of Working Time Act 1997, the average working week cannot exceed 48 hours averaged over a 4-month reference period. Standard full-time hours are 37.5 to 40 hours per week.'
      },
      {
        section_number: '2.0',
        title: 'Daily & Weekly Rest Breaks',
        content: 'Employees are entitled to: a 15-minute break after working 4.5 hours; a 30-minute break after working 6 hours; 11 consecutive hours of daily rest in each 24-hour period; and 24 consecutive hours of weekly rest.'
      },
      {
        section_number: '3.0',
        title: 'Annual Leave & Public Holidays',
        content: 'Full-time employees are entitled to a minimum of 4 working weeks (20 days) paid annual leave per year, plus statutory paid benefit for Ireland’s 10 public holidays.'
      },
      {
        section_number: '4.0',
        title: 'Right to Disconnect',
        content: 'In accordance with the Code of Practice on the Right to Disconnect, employees have the right to not routinely perform work outside normal working hours and not be penalized for disengaging from work communications outside working time.'
      }
    ]
  },

  // ==========================================
  // UNITED STATES (US) TEMPLATES
  // ==========================================
  {
    id: 'us-equal-opportunity-policy',
    title: 'Equal Employment Opportunity & Anti-Discrimination Policy',
    category: 'policy',
    policy_type: 'equal_opportunity',
    jurisdiction: 'US',
    jurisdiction_name: 'United States',
    suggested_code: 'POL-US-EEO-001',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Compliant with Title VII of the Civil Rights Act of 1964, ADA, ADEA, and federal EEOC guidelines.',
    sections: [
      {
        section_number: '1.0',
        title: 'Equal Opportunity Commitment',
        content: 'The company provides equal employment opportunities to all employees and applicants without regard to race, color, religion, sex (including pregnancy, gender identity, and sexual orientation), national origin, age (40 or older), disability, genetic information, or veteran status.'
      },
      {
        section_number: '2.0',
        title: 'Harassment & Discrimination Prohibition',
        content: 'Harassment or discrimination based on any protected characteristic is strictly illegal and violates company policy. This includes verbal slurs, derogatory comments, offensive jokes, and unwelcome physical conduct.'
      },
      {
        section_number: '3.0',
        title: 'Reasonable Accommodation',
        content: 'Under the Americans with Disabilities Act (ADA) and Pregnant Workers Fairness Act (PWFA), reasonable accommodations will be provided to qualified individuals with known physical or mental disabilities or pregnancy-related conditions.'
      },
      {
        section_number: '4.0',
        title: 'At-Will Employment Statement',
        content: 'Employment with the company is on an "at-will" basis, meaning that either the employee or the company may terminate the employment relationship at any time, with or without cause or advance notice.'
      }
    ]
  },

  // ==========================================
  // GLOBAL & MULTI-JURISDICTION POLICIES (REQ BY USER)
  // ==========================================
  {
    id: 'global-ai-usage-policy',
    title: 'AI & Generative AI Usage Policy',
    category: 'policy',
    policy_type: 'ai_usage',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-AI-010',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Governs the safe, ethical, and secure use of Artificial Intelligence (AI) and Generative AI tools (ChatGPT, Claude, GitHub Copilot) in business operations.',
    sections: [
      {
        section_number: '1.0',
        title: 'Purpose & Permitted Use',
        content: 'This policy governs the ethical and secure use of Artificial Intelligence (AI) and LLM tools. Employees may use approved enterprise AI tools solely to enhance productivity, assist drafting, and analyze non-confidential data.'
      },
      {
        section_number: '2.0',
        title: 'Prohibition of Confidential Data Input',
        content: 'Employees are STRICTLY PROHIBITED from inputting proprietary source code, client PII, trade secrets, financial projections, or unreleased product details into public or non-enterprise AI models that use inputs for model training.'
      },
      {
        section_number: '3.0',
        title: 'Human Oversight & Verification',
        content: 'AI-generated outputs (code, copy, analysis) must be thoroughly reviewed and validated by a qualified employee prior to deployment or publication. Employees remain 100% accountable for the accuracy and quality of work delivered.'
      },
      {
        section_number: '4.0',
        title: 'Intellectual Property & Copyright',
        content: 'Employees must ensure that AI outputs do not infringe upon third-party copyrights or licenses (e.g., GPL code snippet ingestion). All work products generated with AI assistance during employment remain exclusive company IP.'
      }
    ]
  },
  {
    id: 'global-data-privacy-policy',
    title: 'Data Privacy & Personal Data Protection Policy',
    category: 'policy',
    policy_type: 'data_privacy',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-DPP-011',
    target_audience: 'All Employees',
    enforcement_level: 'Strict Compliance',
    summary: 'Universal principles for collecting, handling, storing, and securing personal data under GDPR, India DPDP Act 2023, and global privacy standards.',
    sections: [
      {
        section_number: '1.0',
        title: 'Core Privacy Commitments',
        content: 'The company is committed to upholding data subject privacy in accordance with global regulations including GDPR, India DPDP Act 2023, CCPA, and UK Data Protection Act. Personal data shall be processed only with legal basis or explicit consent.'
      },
      {
        section_number: '2.0',
        title: 'Data Security & Access Controls',
        content: 'Personal data must be encrypted at rest and in transit. Access is granted strictly on a need-to-know basis. Sharing personal data with unauthorized third parties or unapproved cloud tools is prohibited.'
      },
      {
        section_number: '3.0',
        title: 'Data Retention & Erasure',
        content: 'Personal data shall be retained only for as long as necessary to fulfill statutory obligations or legitimate business purposes, after which it must be permanently erased or anonymized.'
      }
    ]
  },
  {
    id: 'global-ip-invention-policy',
    title: 'Intellectual Property & Invention Assignment Policy',
    category: 'policy',
    policy_type: 'ip_invention_assignment',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-IPA-012',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Assigns all workplace inventions, software code, patents, trademarks, and documentation created during employment to the company.',
    sections: [
      {
        section_number: '1.0',
        title: 'Ownership of Work Product',
        content: 'All copyrightable works, software code, algorithms, designs, trade secrets, inventions, and documentation created, developed, or reduced to practice by an employee during employment belong exclusively to the company.'
      },
      {
        section_number: '2.0',
        title: 'Invention Assignment',
        content: 'The employee hereby irrevocably assigns to the company all right, title, and interest worldwide in and to any and all Intellectual Property created using company resources or related to company business.'
      },
      {
        section_number: '3.0',
        title: 'Disclosure Obligation',
        content: 'Employees must promptly disclose in writing to company management all inventions, software developments, or proprietary processes developed during their tenure.'
      }
    ]
  },
  {
    id: 'global-confidentiality-nda-policy',
    title: 'Confidentiality & Non-Disclosure Policy',
    category: 'policy',
    policy_type: 'confidentiality_nda',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-NDA-013',
    target_audience: 'All Employees',
    enforcement_level: 'Strict Compliance',
    summary: 'Protects proprietary trade secrets, financial records, client records, source code, and strategic plans during and after employment.',
    sections: [
      {
        section_number: '1.0',
        title: 'Definition of Confidential Information',
        content: 'Confidential Information includes all non-public technical data, source code, customer lists, financial figures, pricing matrices, marketing strategies, employee data, and business plans.'
      },
      {
        section_number: '2.0',
        title: 'Duty of Non-Disclosure',
        content: 'Employees shall hold all Confidential Information in strict confidence and shall not disclose or use such information outside the scope of authorized employment duties without prior written consent.'
      },
      {
        section_number: '3.0',
        title: 'Surrender of Materials upon Separation',
        content: 'Upon resignation or termination, employees must immediately surrender all company hardware, storage media, passwords, files, and documents, and delete any local copies.'
      }
    ]
  },
  {
    id: 'global-acceptable-use-policy',
    title: 'Acceptable Use & IT Asset Policy',
    category: 'policy',
    policy_type: 'acceptable_use',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-AUP-014',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Defines permissible use of laptops, mobile devices, company email, network infrastructure, and cloud environments.',
    sections: [
      {
        section_number: '1.0',
        title: 'IT Hardware & Network Use',
        content: 'Company-issued laptops, mobile phones, and network infrastructure are designated for official business purposes. Minimal personal use is permitted provided it does not compromise security or productivity.'
      },
      {
        section_number: '2.0',
        title: 'Password & Authentication Hygiene',
        content: 'Employees must use strong passwords and mandatory Multi-Factor Authentication (MFA). Passwords must never be shared or stored in plain text documents.'
      },
      {
        section_number: '3.0',
        title: 'Prohibited Software & Shadow IT',
        content: 'Installing unauthorized third-party software, file-sharing applications, or utilizing unvetted cloud software ("Shadow IT") on company assets is strictly forbidden.'
      }
    ]
  },
  {
    id: 'global-remote-hybrid-policy',
    title: 'Remote & Hybrid Work Policy',
    category: 'policy',
    policy_type: 'remote_hybrid_work',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-RWP-015',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Guidelines for working remotely, home office ergonomics, information security outside office premises, and core overlap availability.',
    sections: [
      {
        section_number: '1.0',
        title: 'Eligibility & Scheduling',
        content: 'Remote or hybrid work arrangements require prior approval from the department head. Employees must maintain specified core working hours and be reachable via company chat and video channels.'
      },
      {
        section_number: '2.0',
        title: 'Remote Environment Security',
        content: 'Remote workers must operate from a secure private workspace, connect via approved corporate VPN, lock computer screens when away, and ensure company conversations cannot be overheard.'
      },
      {
        section_number: '3.0',
        title: 'Ergonomics & Equipment',
        content: 'The company provides standard IT hardware. Employees are responsible for maintaining a safe, ergonomically suitable workspace and reliable high-speed internet connection.'
      }
    ]
  },
  {
    id: 'global-grievance-redressal-policy',
    title: 'Grievance Redressal Policy',
    category: 'policy',
    policy_type: 'grievance_redressal',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-GRP-016',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Provides a structured framework for employees to raise workplace grievances without fear of reprisal.',
    sections: [
      {
        section_number: '1.0',
        title: 'Framework & Right to Fair Hearing',
        content: 'The company is committed to providing a fair, transparent mechanism for resolving workplace grievances related to employment terms, working conditions, or interpersonal conflicts.'
      },
      {
        section_number: '2.0',
        title: 'Escalation Hierarchy',
        content: 'Level 1: Informal resolution with immediate supervisor. Level 2: Formal written grievance to HR Department (investigated within 7 working days). Level 3: Appeal to Grievance Redressal Committee.'
      },
      {
        section_number: '3.0',
        title: 'Protection Against Retaliation',
        content: 'No employee shall suffer adverse employment consequences for filing a grievance in good faith or providing testimony in a grievance proceeding.'
      }
    ]
  },
  {
    id: 'global-conflict-interest-policy',
    title: 'Conflict of Interest Policy',
    category: 'policy',
    policy_type: 'conflict_of_interest',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-COI-017',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Requires disclosure and management of personal, financial, or familial interests that conflict with company obligations.',
    sections: [
      {
        section_number: '1.0',
        title: 'Duty of Loyalty',
        content: 'Employees must act in the best interests of the company and avoid situations where personal relationships, financial holdings, or external activities conflict with company responsibilities.'
      },
      {
        section_number: '2.0',
        title: 'Outside Employment & Directorships',
        content: 'Full-time employees may not engage in secondary employment, consulting, or serve on boards of directors of external entities without explicit written approval from HR and Legal.'
      },
      {
        section_number: '3.0',
        title: 'Mandatory Annual Disclosure',
        content: 'Employees must complete an annual Conflict of Interest disclosure form and immediately update HR upon any change in personal circumstances.'
      }
    ]
  },
  {
    id: 'global-anti-bribery-gifts-policy',
    title: 'Gifts, Hospitality & Anti-Bribery Policy',
    category: 'policy',
    policy_type: 'gifts_antibribery',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-ABC-018',
    target_audience: 'All Employees',
    enforcement_level: 'Strict Compliance',
    summary: 'Zero-tolerance policy for bribery, kickbacks, FCPA violations, and excessive corporate gifting.',
    sections: [
      {
        section_number: '1.0',
        title: 'Zero Tolerance for Bribery',
        content: 'The company strictly prohibits offering, promising, giving, requesting, or accepting bribes, kickbacks, or facilitation payments to public officials or commercial partners worldwide.'
      },
      {
        section_number: '2.0',
        title: 'Gift & Hospitality Thresholds',
        content: 'Gifts or business entertainment exceeding $50 USD (or local currency equivalent) must be declared and pre-approved by the Compliance Officer. Cash or cash equivalents (gift cards) are strictly prohibited.'
      }
    ]
  },
  {
    id: 'global-recruitment-background-policy',
    title: 'Recruitment & Background Verification Policy',
    category: 'policy',
    policy_type: 'recruitment_background',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-RBV-019',
    target_audience: 'HR & Operations Staff',
    enforcement_level: 'Mandatory',
    summary: 'Governs fair talent acquisition, reference checking, education verification, and background checks.',
    sections: [
      {
        section_number: '1.0',
        title: 'Merit-Based Selection',
        content: 'Recruitment is conducted strictly on merit, skills, and cultural alignment. All candidates must complete formal application procedures.'
      },
      {
        section_number: '2.0',
        title: 'Pre-Employment Background Checks',
        content: 'Offers of employment are contingent upon successful background verification, including education degree validation, previous employment references, identity verification, and criminal record checks (where legally permissible).'
      }
    ]
  },
  {
    id: 'global-probation-confirmation-policy',
    title: 'Probation & Confirmation Policy',
    category: 'policy',
    policy_type: 'probation_confirmation',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-PCP-020',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Defines probation period evaluation criteria, extensions, and employment confirmation workflow.',
    sections: [
      {
        section_number: '1.0',
        title: 'Probationary Period Duration',
        content: 'New hires undergo a standard probation period of 3 to 6 months. During probation, performance and conduct are reviewed regularly by the line manager.'
      },
      {
        section_number: '2.0',
        title: 'Confirmation Assessment',
        content: 'Upon satisfactory completion of probation, HR issues a formal Written Confirmation Letter. If performance falls below expectations, probation may be extended by up to 3 months or employment terminated per contract terms.'
      }
    ]
  },
  {
    id: 'global-performance-management-policy',
    title: 'Performance Management Policy',
    category: 'policy',
    policy_type: 'performance_management',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-PMP-021',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Framework for annual reviews, OKR/KPI setting, quarterly check-ins, and Performance Improvement Plans (PIP).',
    sections: [
      {
        section_number: '1.0',
        title: 'Continuous Feedback & Review Cycle',
        content: 'Performance management operates on goal setting (OKRs/KPIs), mid-year check-ins, and annual formal performance reviews. Both manager self-evaluations and 360-degree feedback are utilized.'
      },
      {
        section_number: '2.0',
        title: 'Performance Improvement Plan (PIP)',
        content: 'Employees displaying consistent underperformance shall be placed on a 30 to 60-day structured PIP with clear targets and weekly manager reviews before any adverse administrative action is initiated.'
      }
    ]
  },
  {
    id: 'global-compensation-benefits-policy',
    title: 'Compensation & Benefits Policy',
    category: 'policy',
    policy_type: 'compensation_benefits',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'POL-GL-CBP-022',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Outlines salary structure, pay cycles, annual appraisal increments, performance bonuses, and health insurance benefits.',
    sections: [
      {
        section_number: '1.0',
        title: 'Salary Structure & Payment Schedule',
        content: 'Salaries are benchmarked to market industry standards and paid monthly on the designated pay date via direct electronic bank transfer. Itemized salary slips are published in the employee portal.'
      },
      {
        section_number: '2.0',
        title: 'Annual Increment & Bonus Review',
        content: 'Salary revisions and performance bonuses are evaluated annually based on company financial performance, individual performance ratings, and market inflation.'
      }
    ]
  },

  // ==========================================
  // STANDARD OPERATING PROCEDURES (SOPs)
  // ==========================================
  {
    id: 'sop-onboarding-workflow',
    title: 'Employee Onboarding SOP',
    category: 'sop',
    policy_type: 'onboarding_sop',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'SOP-GL-ONB-001',
    target_audience: 'HR & Operations Staff',
    enforcement_level: 'Mandatory',
    summary: 'Step-by-step procedure for welcoming, equipping, and provisioning access for new hires on Day 1 through Week 4.',
    sections: [
      {
        section_number: '1.0',
        title: 'Pre-Arrival Preparation (Day -7 to Day -1)',
        content: '1. HR sends welcome email & documentation portal login.\n2. IT provisions laptop, Google Workspace / Microsoft 365, Slack/Teams, and VPN access.\n3. Manager assigns onboarding buddy.'
      },
      {
        section_number: '2.0',
        title: 'Day 1 Induction',
        content: '1. HR Orientation: Document submission check, benefits review, POSH & GDPR policy sign-off.\n2. IT Setup: Hardware handoff, MFA configuration, security awareness briefing.\n3. Team Welcome Meeting.'
      },
      {
        section_number: '3.0',
        title: 'Week 1 to Month 1 Checkpoints',
        content: '1. End of Week 1: HR & Manager check-in.\n2. 30-Day Milestone: Formal probation alignment & goal review.'
      }
    ]
  },
  {
    id: 'sop-offboarding-workflow',
    title: 'Employee Offboarding SOP',
    category: 'sop',
    policy_type: 'offboarding_sop',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'SOP-GL-OFF-002',
    target_audience: 'HR & Operations Staff',
    enforcement_level: 'Mandatory',
    summary: 'Standardized operational steps for exit clearance, asset recovery, account revocation, and full & final settlement.',
    sections: [
      {
        section_number: '1.0',
        title: 'Resignation & Notice Period Tracking',
        content: '1. Resignation accepted in writing by manager and HR.\n2. HR issues Exit Instructions and confirms official last working day based on notice period.'
      },
      {
        section_number: '2.0',
        title: 'Knowledge Transfer & Asset Recovery',
        content: '1. KT Sign-off completed by department lead.\n2. IT retrieves company laptop, access badges, and mobile devices.\n3. Immediate revocation of enterprise systems access at 5:00 PM on last working day.'
      },
      {
        section_number: '3.0',
        title: 'Exit Interview & Settlement',
        content: '1. HR conducts exit interview.\n2. Finance processes Full & Final Settlement (including encashment & gratuity) within statutory timeline.'
      }
    ]
  },
  {
    id: 'sop-expense-travel-reimbursement',
    title: 'Expense & Travel Reimbursement SOP',
    category: 'sop',
    policy_type: 'expense_reimbursement_sop',
    jurisdiction: 'GLOBAL',
    jurisdiction_name: 'Global / EU Standard',
    suggested_code: 'SOP-GL-EXP-003',
    target_audience: 'All Employees',
    enforcement_level: 'Mandatory',
    summary: 'Standard procedure for incurring, submitting, approving, and reimbursing business travel and operational expenses.',
    sections: [
      {
        section_number: '1.0',
        title: 'Permissible Business Expenses',
        content: 'Reimbursable expenses include client entertainment, business travel (economy flight / standard rail), lodging within company per-diem limits, and pre-approved client meals.'
      },
      {
        section_number: '2.0',
        title: 'Submission & Receipt Requirements',
        content: 'All claims must be submitted via the Expense Management Portal within 30 days of occurrence. Itemized GST/VAT tax invoices are mandatory for claims exceeding $10 / ₹500.'
      },
      {
        section_number: '3.0',
        title: 'Approval & Payout Schedule',
        content: 'Level 1: Manager approval within 3 working days. Level 2: Finance audit. Reimbursements are disbursed on the 15th and 30th of each month.'
      }
    ]
  }
];
