import type { ContractType } from '../types/contract';

export interface IrishTemplateSection {
  section_number: number;
  section_title: string;
  section_content: string;
  is_locked: boolean;       // true = compliance clause, user cannot edit
  is_required: boolean;
  page_break_before: boolean;
}

export interface IrishContractTemplate {
  contract_type: ContractType;
  label: string;
  contract_title: string;
  preamble: string;
  currency_code: string;
  sections: IrishTemplateSection[];
}

// ── Shared Irish law compliance clauses injected into every template ──────────

const GOVERNING_LAW: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Governing Law and Jurisdiction',
  section_content: `This Agreement shall be governed by and construed in accordance with the laws of Ireland. The parties hereby irrevocably submit to the exclusive jurisdiction of the courts of Ireland in relation to any dispute or claim arising out of or in connection with this Agreement or its subject matter or formation (including non-contractual disputes or claims). Nothing in this clause shall limit the right of either party to seek injunctive or other equitable relief in any court of competent jurisdiction.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const DATA_PROTECTION: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Data Protection and Privacy',
  section_content: `Each party shall comply with its obligations under the General Data Protection Regulation (EU) 2016/679 ("GDPR"), the Data Protection Act 2018 (Ireland), and any applicable subordinate legislation as amended from time to time. Where either party processes personal data on behalf of the other, the parties shall execute a Data Processing Agreement in accordance with Article 28 of the GDPR. Each party shall implement appropriate technical and organisational measures to protect personal data against unauthorised or unlawful processing and against accidental loss, destruction, damage, alteration or disclosure.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const ANTI_BRIBERY: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Anti-Bribery and Anti-Corruption',
  section_content: `Each party shall comply with all applicable laws, statutes, regulations and codes relating to anti-bribery and anti-corruption including but not limited to the Prevention of Corruption Acts 1889–2010 (as amended), the Criminal Justice (Corruption Offences) Act 2018, and the UK Bribery Act 2010 where applicable. Neither party shall engage in any activity, practice or conduct which would constitute an offence under such legislation. Each party shall maintain adequate procedures to prevent bribery and corruption by persons associated with it.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const DISPUTE_RESOLUTION: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Dispute Resolution',
  section_content: `If a dispute arises out of or in connection with this Agreement ("Dispute"), the parties shall first attempt to resolve the Dispute through good-faith negotiation. If the Dispute is not resolved within thirty (30) days of written notice, either party may refer the Dispute to mediation administered by the Mediators' Institute of Ireland. If mediation fails, either party may commence legal proceedings in accordance with the governing law clause above. Nothing in this clause prevents either party from seeking urgent injunctive relief from a court of competent jurisdiction.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const FORCE_MAJEURE: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Force Majeure',
  section_content: `Neither party shall be liable for any delay or failure to perform its obligations under this Agreement if such delay or failure results from circumstances beyond that party's reasonable control, including but not limited to acts of God, natural disasters, epidemic or pandemic declared by a competent authority, war, riot, civil commotion, governmental action, strikes or labour disputes (other than those involving that party's own employees), or failure of a third-party utility service. The affected party shall promptly notify the other party in writing and shall use reasonable endeavours to mitigate the effect of the force majeure event.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const LIMITATION_OF_LIABILITY: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Limitation of Liability',
  section_content: `To the maximum extent permitted by Irish law, neither party shall be liable to the other for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or goodwill, whether arising in contract, tort (including negligence), or otherwise, even if advised of the possibility of such damages. Subject to the above, each party's total aggregate liability arising out of or in connection with this Agreement shall not exceed the total fees paid or payable by the Client in the twelve (12) months preceding the event giving rise to the claim. Nothing in this Agreement shall limit or exclude liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any liability that cannot be excluded or limited under Irish law.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const CONFIDENTIALITY: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Confidentiality',
  section_content: `Each party ("Receiving Party") undertakes to keep confidential all Confidential Information disclosed by the other party ("Disclosing Party") and shall not disclose such information to any third party without the prior written consent of the Disclosing Party, except as required by law or by any competent regulatory authority. "Confidential Information" means any information that is marked as confidential or that a reasonable person would consider to be confidential given its nature and the circumstances of disclosure. The obligation of confidentiality shall survive termination or expiry of this Agreement for a period of five (5) years.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const TERMINATION: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Termination',
  section_content: `Either party may terminate this Agreement immediately by written notice if the other party: (a) commits a material breach of this Agreement and, where such breach is capable of remedy, fails to remedy it within thirty (30) days of written notice requiring it to do so; (b) becomes insolvent, enters administration, receivership, or liquidation, or makes an arrangement with its creditors generally under Irish law; or (c) ceases to trade. Upon termination, each party shall return or destroy all Confidential Information of the other party and pay any outstanding sums due. Termination shall not affect any accrued rights or liabilities of either party.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

// ── New shared commercial clauses ────────────────────────────────────────────

const BRAND_AND_LOGO_USAGE: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Brand and Logo Usage',
  section_content: `Each party ("Licensor") hereby grants the other party ("Licensee") a non-exclusive, royalty-free, revocable licence to display the Licensor's name, logo, and trademarks ("Brand Assets") solely for the purpose of promoting the commercial relationship between the parties on the Licensee's website, social media channels, and other digital marketing platforms. The Licensee shall: (a) use Brand Assets only in their approved form and in accordance with any brand guidelines provided by the Licensor; (b) not alter, distort, or create derivative works from the Brand Assets; (c) not use the Brand Assets in any manner that is misleading, disparaging, or that could damage the Licensor's reputation; (d) upon written request from the Licensor, promptly remove or modify any use of the Brand Assets within five (5) business days. This licence does not confer any ownership rights in the Brand Assets and shall terminate automatically upon expiry or termination of this Agreement.`,
  is_locked: false,
  is_required: false,
  page_break_before: false,
};

const REPRESENTATION_RESTRICTIONS: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Restrictions on Representation',
  section_content: `Neither party shall, without the prior written consent of the other: (a) represent, hold out, or imply to any third party that it acts as an agent, partner, joint venturer, or legal representative of the other party; (b) make any commitment, warranty, or representation on behalf of the other party to any external entity; (c) enter into any contract or incur any liability in the name of or on behalf of the other party; or (d) use the other party's name, credentials, or authority to obtain credit, goods, services, or contracts from third parties. Each party shall be solely responsible for its own representations and actions in dealings with third parties. This clause survives termination of the Agreement for a period of two (2) years.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const MARKETING_PARTICIPATION: IrishTemplateSection = {
  section_number: 0,
  section_title: 'Marketing Participation and Case Studies',
  section_content: `The Service Provider may request the Client to participate in marketing activities, including customer interviews, testimonials, case studies, white papers, and press releases ("Marketing Activities"), subject to the following conditions: (a) Participation is entirely voluntary; the Client may decline any request without affecting the terms of this Agreement or the performance of the Services; (b) Prior to any Marketing Activity, the parties shall agree in writing on: (i) a pre-approved agenda specifying the topics, format, and scope of the activity; (ii) the scheduled date and time; (iii) the specific media channels and platforms on which the content will be published; and (iv) the approval process for reviewing and signing off all content before publication; (c) The Client shall retain the right to review and approve all content featuring the Client's name, logo, personnel, or business information before publication; (d) The Client may withdraw approval at any time prior to publication; (e) No Marketing Activity shall disclose any Confidential Information without separate written consent. Any content produced under this clause remains subject to the Confidentiality obligations set out elsewhere in this Agreement.`,
  is_locked: false,
  is_required: false,
  page_break_before: false,
};

/** Assigns sequential numbers: editable → brand/marketing commercial clauses → compliance → representation lock. */
function buildSections(editableSections: Omit<IrishTemplateSection, 'section_number'>[], complianceClauses: Omit<IrishTemplateSection, 'section_number'>[]): IrishTemplateSection[] {
  let n = 1;
  return [
    ...editableSections.map(s => ({ ...s, section_number: n++ })),
    { ...BRAND_AND_LOGO_USAGE, section_number: n++ },
    { ...MARKETING_PARTICIPATION, section_number: n++ },
    ...complianceClauses.map(s => ({ ...s, section_number: n++ })),
    { ...REPRESENTATION_RESTRICTIONS, section_number: n++ },
  ];
}

// ── Template definitions ───────────────────────────────────────────────────

export const IRISH_CONTRACT_TEMPLATES: IrishContractTemplate[] = [
  {
    contract_type: 'MSA',
    label: 'Master Services Agreement (Irish Law)',
    contract_title: 'Master Services Agreement',
    currency_code: 'EUR',
    preamble: `THIS MASTER SERVICES AGREEMENT ("Agreement") is entered into on the date last signed below between the parties identified as Party A (Service Provider) and Party B (Client), each incorporated and registered in accordance with the laws of Ireland (the "Companies Act 2014") or such other applicable jurisdiction. This Agreement governs the general terms and conditions under which the Service Provider will provide services to the Client as set out in individual Statements of Work or Purchase Orders issued hereunder.`,
    sections: buildSections([
      {
        section_title: 'Definitions',
        section_content: `In this Agreement, the following terms shall have the following meanings:\n\n"Services" means the services to be provided by the Service Provider as described in a Statement of Work.\n"Deliverables" means any work product, report, document, or other output produced in connection with the Services.\n"Fees" means the amounts payable by the Client for the Services as set out in the applicable Statement of Work.\n"Intellectual Property Rights" means all patents, copyrights, database rights, moral rights, trade marks, know-how, and any other intellectual or industrial property rights.\n"Statement of Work" or "SOW" means a written order or statement referencing this Agreement and setting out the specific Services, Deliverables, timeline, and Fees.`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Services',
        section_content: `The Service Provider shall perform the Services in accordance with the terms of this Agreement and the applicable Statement of Work. The Service Provider shall use reasonable skill and care in the performance of the Services and shall comply with all applicable Irish and EU laws and regulations. The parties shall agree individual Statements of Work in writing before commencement of any services.`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Fees and Payment',
        section_content: `[EDITABLE – Insert fee structure, invoicing schedule, payment terms, and late payment interest in accordance with the European Communities (Late Payment in Commercial Transactions) Regulations 2012 (S.I. No. 580 of 2012).]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Intellectual Property',
        section_content: `All pre-existing intellectual property of the Service Provider shall remain the property of the Service Provider. Unless otherwise agreed in a Statement of Work, the Service Provider grants the Client a non-exclusive, non-transferable licence to use any Deliverables for the Client's internal business purposes. The Client retains all rights in materials provided by the Client to the Service Provider.`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Scope of Work',
        section_content: ``,
        is_locked: false, is_required: false, page_break_before: true,
      },
    ], [CONFIDENTIALITY, DATA_PROTECTION, ANTI_BRIBERY, LIMITATION_OF_LIABILITY, FORCE_MAJEURE, DISPUTE_RESOLUTION, TERMINATION, GOVERNING_LAW]),
  },

  {
    contract_type: 'SOW',
    label: 'Statement of Work (Irish Law)',
    contract_title: 'Statement of Work',
    currency_code: 'EUR',
    preamble: `THIS STATEMENT OF WORK ("SOW") is issued pursuant to the Master Services Agreement between the parties (or as a standalone agreement where no MSA exists) and sets out the specific services, deliverables, timelines, and commercial terms agreed between the parties.`,
    sections: buildSections([
      {
        section_title: 'Project Overview',
        section_content: `[EDITABLE – Describe the project, objectives, and background context.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Scope of Work',
        section_content: ``,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Deliverables',
        section_content: `[EDITABLE – List all deliverables with acceptance criteria and formats.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Timeline and Milestones',
        section_content: `[EDITABLE – Set out the project schedule, key milestone dates, and dependencies.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Fees and Payment Schedule',
        section_content: `[EDITABLE – Specify fees, invoicing milestones, and payment terms. Late payment interest applies per S.I. No. 580 of 2012.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Resources and Responsibilities',
        section_content: `[EDITABLE – Identify named resources, their roles, and the responsibilities of each party.]`,
        is_locked: false, is_required: false, page_break_before: false,
      },
      {
        section_title: 'Change Control',
        section_content: `Any change to the scope, deliverables, timeline, or fees must be agreed in writing via a signed Change Request. The parties shall discuss and agree any impact on timeline and fees before implementing a change.`,
        is_locked: false, is_required: false, page_break_before: false,
      },
    ], [DATA_PROTECTION, LIMITATION_OF_LIABILITY, FORCE_MAJEURE, GOVERNING_LAW]),
  },

  {
    contract_type: 'NDA',
    label: 'Non-Disclosure Agreement (Irish Law)',
    contract_title: 'Non-Disclosure Agreement',
    currency_code: 'EUR',
    preamble: `THIS NON-DISCLOSURE AGREEMENT ("Agreement") is entered into between the parties for the purpose of protecting Confidential Information exchanged in connection with the Permitted Purpose defined herein. The parties acknowledge that all Confidential Information remains the property of the Disclosing Party.`,
    sections: buildSections([
      {
        section_title: 'Permitted Purpose',
        section_content: `[EDITABLE – Define the specific purpose for which Confidential Information may be used (e.g., evaluation of a potential business relationship, due diligence, project collaboration).]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Obligations of Receiving Party',
        section_content: `The Receiving Party shall: (a) hold Confidential Information in strict confidence; (b) use it solely for the Permitted Purpose; (c) restrict disclosure to those employees or advisors who need to know and who are bound by equivalent obligations of confidentiality; (d) immediately notify the Disclosing Party upon discovery of any unauthorised disclosure; and (e) upon request, promptly return or certifiably destroy all materials containing Confidential Information.`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Exclusions from Confidentiality',
        section_content: `The obligations above shall not apply to information that: (a) is or becomes publicly available through no breach of this Agreement; (b) was lawfully known to the Receiving Party before disclosure; (c) is independently developed by the Receiving Party without use of Confidential Information; or (d) is required to be disclosed by law, regulation, or order of a court or competent authority, provided prompt notice is given to the Disclosing Party where lawfully permitted.`,
        is_locked: true, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Scope of Work',
        section_content: ``,
        is_locked: false, is_required: false, page_break_before: false,
      },
      {
        section_title: 'Duration',
        section_content: `[EDITABLE – Specify the term of confidentiality obligations (e.g., 2 years, 5 years, or indefinitely for trade secrets).]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
    ], [DATA_PROTECTION, DISPUTE_RESOLUTION, GOVERNING_LAW]),
  },

  {
    contract_type: 'WORK_ORDER',
    label: 'Work Order (Irish Law)',
    contract_title: 'Work Order',
    currency_code: 'EUR',
    preamble: `THIS WORK ORDER ("Work Order") is issued by the Client to the Service Provider and constitutes a binding contract for the specific work described herein. This Work Order incorporates the terms of any applicable Master Services Agreement; where no MSA exists, the standard terms below shall apply.`,
    sections: buildSections([
      {
        section_title: 'Work Description',
        section_content: `[EDITABLE – Describe the specific work to be performed, including technical specifications, standards, and any reference documents.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Scope of Work',
        section_content: ``,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Location and Access',
        section_content: `[EDITABLE – Specify where the work will be performed (on-site/remote), access requirements, and health and safety obligations under the Safety, Health and Welfare at Work Act 2005.]`,
        is_locked: false, is_required: false, page_break_before: false,
      },
      {
        section_title: 'Schedule',
        section_content: `[EDITABLE – Set out start date, completion date, and any interim deadlines.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Price and Payment',
        section_content: `[EDITABLE – Specify the fixed price or time-and-materials rate, VAT treatment, and payment terms.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Acceptance',
        section_content: `[EDITABLE – Define the acceptance criteria and the acceptance procedure. Work shall be deemed accepted if the Client does not raise written objections within [X] business days of delivery.]`,
        is_locked: false, is_required: false, page_break_before: false,
      },
    ], [LIMITATION_OF_LIABILITY, FORCE_MAJEURE, DISPUTE_RESOLUTION, GOVERNING_LAW]),
  },

  {
    contract_type: 'MAINTENANCE',
    label: 'Maintenance Agreement (Irish Law)',
    contract_title: 'Maintenance and Support Agreement',
    currency_code: 'EUR',
    preamble: `THIS MAINTENANCE AND SUPPORT AGREEMENT ("Agreement") sets out the terms on which the Service Provider will provide ongoing maintenance, support, and related services for the systems, software, or equipment described herein. The parties acknowledge their obligations under consumer and commercial law applicable in Ireland.`,
    sections: buildSections([
      {
        section_title: 'Services Description',
        section_content: `[EDITABLE – Define the systems, software, or equipment covered; the type of maintenance (preventive, corrective, adaptive); and any exclusions from scope.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Scope of Work',
        section_content: ``,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Service Levels',
        section_content: `[EDITABLE – Specify response times, resolution targets, availability commitments, and any service credits for failure to meet SLAs.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Term and Renewal',
        section_content: `[EDITABLE – Specify the initial term and auto-renewal provisions, including required notice period for termination. Minimum notice requirements under Irish consumer and commercial law must be observed.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Fees',
        section_content: `[EDITABLE – Specify the maintenance fee, invoicing frequency, and payment terms. VAT at the current standard rate applies where applicable.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Client Obligations',
        section_content: `[EDITABLE – Describe the Client's responsibilities, such as providing access, keeping the environment updated, maintaining backups, and designating a technical contact.]`,
        is_locked: false, is_required: false, page_break_before: false,
      },
    ], [DATA_PROTECTION, LIMITATION_OF_LIABILITY, FORCE_MAJEURE, TERMINATION, GOVERNING_LAW]),
  },

  {
    contract_type: 'CONSULTING',
    label: 'Consulting Agreement (Irish Law)',
    contract_title: 'Consulting Agreement',
    currency_code: 'EUR',
    preamble: `THIS CONSULTING AGREEMENT ("Agreement") is entered into between the Consultant and the Client for the provision of independent consulting services. The parties acknowledge that the Consultant acts as an independent contractor and nothing herein shall create or be deemed to create a relationship of employment, agency, or partnership between the parties. The parties confirm compliance with applicable Irish employment and tax legislation, including the Code of Practice for Determining Employment or Self-Employment Status of Individuals issued by the Irish Revenue Commissioners.`,
    sections: buildSections([
      {
        section_title: 'Services',
        section_content: `[EDITABLE – Describe the consulting services, areas of expertise engaged, and expected outputs or advisory deliverables.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Scope of Work',
        section_content: ``,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Independent Contractor Status',
        section_content: `The Consultant is an independent contractor and is solely responsible for the payment of all taxes, PRSI, USC, and other statutory levies arising from fees received under this Agreement. The Consultant shall not hold out as an employee or agent of the Client and shall not bind the Client to any obligation without express written authority. The Client shall not be responsible for providing sick pay, annual leave, or any other employment benefit to the Consultant.`,
        is_locked: true, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Fees and Expenses',
        section_content: `[EDITABLE – Specify the daily or hourly rate, expense reimbursement policy, invoicing procedure, and payment terms.]`,
        is_locked: false, is_required: true, page_break_before: false,
      },
      {
        section_title: 'Intellectual Property',
        section_content: `All work product and deliverables created by the Consultant in the course of providing the Services shall, upon full payment of Fees, be assigned to the Client. The Consultant retains ownership of pre-existing tools, methodologies, and know-how and grants the Client a non-exclusive licence to use them to the extent incorporated in deliverables.`,
        is_locked: false, is_required: true, page_break_before: false,
      },
    ], [CONFIDENTIALITY, DATA_PROTECTION, ANTI_BRIBERY, LIMITATION_OF_LIABILITY, DISPUTE_RESOLUTION, TERMINATION, GOVERNING_LAW]),
  },
];

/** Returns the Irish template for a given contract type, or undefined if none exists. */
export const getIrishTemplate = (contractType: ContractType): IrishContractTemplate | undefined =>
  IRISH_CONTRACT_TEMPLATES.find(t => t.contract_type === contractType);
