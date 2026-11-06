import type { ContractType } from '../types/contract';
import type { IrishTemplateSection as TemplateSection, IrishContractTemplate as ContractTemplate } from './irishContractTemplates';

// Re-export types for uniform use
export type { TemplateSection as IndianTemplateSection, ContractTemplate as IndianContractTemplate };

// ── Indian law compliance clauses ────────────────────────────────────────────

const IND_GOVERNING_LAW: TemplateSection = {
  section_number: 0,
  section_title: 'Governing Law and Jurisdiction',
  section_content: `This Agreement shall be governed by and construed in accordance with the laws of India, including the Indian Contract Act 1872, the Specific Relief Act 1963, the Information Technology Act 2000 (as amended by the Information Technology (Amendment) Act 2008), and all other applicable Indian statutes, rules, and regulations. The parties hereby submit to the exclusive jurisdiction of the competent courts at [INSERT CITY], India, in relation to all disputes arising out of or in connection with this Agreement. Nothing herein shall preclude either party from seeking urgent interim or injunctive relief from any court of competent jurisdiction.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const IND_DATA_PROTECTION: TemplateSection = {
  section_number: 0,
  section_title: 'Data Protection and Privacy',
  section_content: `Each party shall comply with all applicable Indian data protection laws and regulations, including the Digital Personal Data Protection Act 2023 ("DPDPA 2023"), the Information Technology Act 2000 and its rules (including the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules 2011), and any subordinate legislation or guidelines issued by the Data Protection Board of India from time to time. Where either party processes personal data on behalf of the other, the parties shall execute a Data Processing Agreement specifying the purposes, retention periods, and security standards applicable to such data. Each party shall implement and maintain appropriate technical and organisational security measures to protect personal data against unauthorised access, disclosure, alteration, or destruction in accordance with the reasonable security practices under the IT Act 2000 Rules.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const IND_ANTI_BRIBERY: TemplateSection = {
  section_number: 0,
  section_title: 'Anti-Bribery and Anti-Corruption',
  section_content: `Each party shall comply with all applicable anti-bribery and anti-corruption laws of India, including the Prevention of Corruption Act 1988 (as amended by the Prevention of Corruption (Amendment) Act 2018), the Prevention of Money Laundering Act 2002 (as amended), and the Foreign Corrupt Practices Act (FCPA) or UK Bribery Act 2010 where applicable to cross-border transactions. Neither party shall, directly or indirectly, offer, pay, promise, or authorise any bribe, kickback, or improper advantage to any public official, government employee, or private individual to obtain or retain business or any improper advantage. Each party shall maintain adequate internal controls, policies, and procedures to prevent bribery and corruption.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const IND_DISPUTE_RESOLUTION: TemplateSection = {
  section_number: 0,
  section_title: 'Dispute Resolution',
  section_content: `If a dispute arises out of or in connection with this Agreement ("Dispute"), the parties shall first attempt to resolve the Dispute through good-faith negotiation within thirty (30) days of written notice. If unresolved, either party may refer the Dispute to mediation or conciliation under the Mediation Act 2023 (India) or the Arbitration and Conciliation Act 1996 (as amended), as the parties may agree. If mediation fails or is not agreed, the Dispute shall be referred to and finally resolved by arbitration in accordance with the Arbitration and Conciliation Act 1996 (as amended by the 2015 and 2019 Amendment Acts), with a sole arbitrator appointed by mutual consent. The seat of arbitration shall be [INSERT CITY], India, and the language of arbitration shall be English. Nothing in this clause prevents either party from seeking urgent injunctive relief from the competent courts.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const IND_FORCE_MAJEURE: TemplateSection = {
  section_number: 0,
  section_title: 'Force Majeure',
  section_content: `Neither party shall be liable for delay or failure to perform obligations under this Agreement if caused by circumstances beyond that party's reasonable control, including acts of God, natural disasters, epidemic or pandemic declared by a competent authority under the Epidemic Diseases Act 1897 or Disaster Management Act 2005, war, civil disturbance, government orders or actions under applicable Indian law, strikes (other than those involving the affected party's own employees), or failure of a third-party infrastructure provider. The affected party shall promptly notify the other party in writing and shall use commercially reasonable endeavours to mitigate the impact. If the force majeure event continues for more than sixty (60) days, either party may terminate the Agreement on written notice without liability, subject to payment for services already rendered.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const IND_LIMITATION_OF_LIABILITY: TemplateSection = {
  section_number: 0,
  section_title: 'Limitation of Liability',
  section_content: `To the maximum extent permitted under applicable Indian law, including the Indian Contract Act 1872 and the Consumer Protection Act 2019 where applicable: (a) neither party shall be liable for any indirect, incidental, special, consequential, or punitive damages, or loss of profits, revenue, data, goodwill, or business opportunity, whether arising in contract, tort, or otherwise; (b) each party's total aggregate liability arising under or in connection with this Agreement shall not exceed the total fees paid or payable in the twelve (12) months preceding the event giving rise to the claim. Nothing herein shall exclude or limit liability for death or personal injury caused by negligence, fraud, fraudulent misrepresentation, or any liability that cannot be excluded under Indian law.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const IND_CONFIDENTIALITY: TemplateSection = {
  section_number: 0,
  section_title: 'Confidentiality',
  section_content: `Each party ("Receiving Party") undertakes to keep confidential all Confidential Information received from the other party ("Disclosing Party") and shall not disclose such information to any third party without prior written consent, except as required by law, regulatory authority, or court order under applicable Indian law. "Confidential Information" includes trade secrets, business plans, technical data, financial information, customer data, and any information that a reasonable person would regard as confidential. The Receiving Party shall use Confidential Information solely for the purposes of this Agreement and shall protect it with at least the same degree of care applied to its own confidential information, and in any event no less than reasonable care. These obligations shall survive termination for a period of five (5) years.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const IND_INTELLECTUAL_PROPERTY: TemplateSection = {
  section_number: 0,
  section_title: 'Intellectual Property Rights',
  section_content: `All pre-existing intellectual property of each party remains the exclusive property of that party. Unless otherwise agreed in a Statement of Work or Schedule, any deliverables, work product, or developments created by the Service Provider specifically for the Client under this Agreement ("Work Product") shall, upon full payment of all Fees, be assigned to the Client. The Service Provider retains ownership of all pre-existing tools, methodologies, frameworks, libraries, and know-how ("Background IP"), and grants the Client a non-exclusive, non-transferable licence to use Background IP to the extent incorporated in the Work Product. The parties' rights and obligations under this clause are governed by the Copyright Act 1957, Patents Act 1970 (as amended), Trade Marks Act 1999, and other applicable Indian intellectual property laws.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const IND_TERMINATION: TemplateSection = {
  section_number: 0,
  section_title: 'Termination',
  section_content: `Either party may terminate this Agreement by providing written notice if the other party: (a) commits a material breach and fails to remedy it within thirty (30) days of written notice; (b) becomes insolvent, is wound up voluntarily or compulsorily, has a receiver appointed, or makes a composition with its creditors under the Insolvency and Bankruptcy Code 2016 or any other applicable Indian law; or (c) ceases to carry on business. Upon termination, each party shall immediately cease using the other's Confidential Information and Brand Assets, return or certifiably destroy all such materials, and settle all outstanding payments. Rights accrued before termination are not affected.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

// ── Shared commercial clauses (Indian law versions) ───────────────────────────

const IND_BRAND_AND_LOGO_USAGE: TemplateSection = {
  section_number: 0,
  section_title: 'Brand and Logo Usage',
  section_content: `Each party ("Licensor") grants the other party ("Licensee") a non-exclusive, royalty-free, revocable licence to display the Licensor's name, logo, and trademarks ("Brand Assets") solely to promote the commercial relationship on the Licensee's website, social media channels, and digital marketing platforms, subject to: (a) use only in approved form and in accordance with any brand guidelines provided; (b) no alteration, distortion, or derivative works from the Brand Assets; (c) no use that is misleading, disparaging, or detrimental to the Licensor's reputation; (d) prompt removal or modification within five (5) business days of a written request. This licence does not transfer ownership and terminates on expiry or termination of this Agreement. Any use of trademarks is subject to the Trade Marks Act 1999 and the Licensor's prior written approval for use beyond the scope stated herein.`,
  is_locked: false,
  is_required: false,
  page_break_before: false,
};

const IND_REPRESENTATION_RESTRICTIONS: TemplateSection = {
  section_number: 0,
  section_title: 'Restrictions on Representation',
  section_content: `Neither party shall, without the prior written consent of the other: (a) represent, hold out, or imply to any third party that it acts as an agent, partner, joint venturer, or legal representative of the other party, as such a relationship would require express agreement under the Indian Contract Act 1872 and the relevant provisions on agency; (b) make any commitment, warranty, or representation on behalf of the other party to any external entity; (c) enter into any contract or incur any liability in the name of or on behalf of the other party; or (d) use the other party's name, credentials, or authority to obtain credit, goods, or services from third parties. Each party is solely responsible for its own representations and actions with third parties. This clause shall survive termination for two (2) years.`,
  is_locked: true,
  is_required: true,
  page_break_before: false,
};

const IND_MARKETING_PARTICIPATION: TemplateSection = {
  section_number: 0,
  section_title: 'Marketing Participation and Case Studies',
  section_content: `The Service Provider may request the Client to participate in marketing activities including customer interviews, testimonials, case studies, white papers, and press releases ("Marketing Activities"), subject to: (a) Participation is entirely voluntary and the Client may decline without consequence to this Agreement; (b) The parties shall agree in writing before any Marketing Activity on: (i) a pre-approved agenda specifying topics, format, and scope; (ii) the scheduled date, time, and duration; (iii) the media channels and platforms for publication; and (iv) the review and sign-off process for all content; (c) The Client retains the right to review and approve all content featuring the Client's name, logo, personnel, or business information; (d) The Client may withdraw approval at any time before publication; (e) No Marketing Activity shall disclose any Confidential Information or personal data without separate written consent and in compliance with the Digital Personal Data Protection Act 2023 and applicable Indian law. All marketing content produced shall be subject to the Copyright Act 1957.`,
  is_locked: false,
  is_required: false,
  page_break_before: false,
};

function buildIndianSections(
  editableSections: Omit<TemplateSection, 'section_number'>[],
  complianceClauses: Omit<TemplateSection, 'section_number'>[]
): TemplateSection[] {
  let n = 1;
  return [
    ...editableSections.map(s => ({ ...s, section_number: n++ })),
    { ...IND_BRAND_AND_LOGO_USAGE, section_number: n++ },
    { ...IND_MARKETING_PARTICIPATION, section_number: n++ },
    ...complianceClauses.map(s => ({ ...s, section_number: n++ })),
    { ...IND_REPRESENTATION_RESTRICTIONS, section_number: n++ },
  ];
}

// ── Indian contract templates ─────────────────────────────────────────────────

export const INDIAN_CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    contract_type: 'MSA',
    label: 'Master Services Agreement (Indian Law)',
    contract_title: 'Master Services Agreement',
    currency_code: 'INR',
    preamble: `THIS MASTER SERVICES AGREEMENT ("Agreement") is entered into between the parties identified as Party A (Service Provider) and Party B (Client), each incorporated under the Companies Act 2013 or such other applicable Indian law. This Agreement governs the terms under which the Service Provider will provide services to the Client as set out in individual Statements of Work or Purchase Orders issued hereunder. This Agreement is binding and enforceable in accordance with the Indian Contract Act 1872.`,
    sections: buildIndianSections([
      { section_title: 'Definitions', section_content: `In this Agreement:\n"Services" means the services to be provided as described in a Statement of Work.\n"Deliverables" means any work product, report, document, or output produced in connection with the Services.\n"Fees" means the amounts payable by the Client as set out in the applicable Statement of Work.\n"Intellectual Property Rights" has the meaning set out in the Intellectual Property clause.\n"Statement of Work" means a written order referencing this Agreement and setting out specific Services, Deliverables, timeline, and Fees.\n"GST" means Goods and Services Tax levied under the Goods and Services Tax Act 2017.`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Services', section_content: `The Service Provider shall perform the Services in accordance with this Agreement and the applicable Statement of Work using reasonable skill, care, and diligence. Services shall comply with all applicable Indian laws, including the Information Technology Act 2000, the Companies Act 2013, the Shops and Establishments Act applicable to the relevant state, and all applicable labour laws. Individual Statements of Work shall be agreed in writing before commencement.`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Fees, GST, and Payment', section_content: `[EDITABLE – Insert fee structure, GST treatment (including applicable HSN/SAC codes and GST rates), invoicing schedule, and payment terms. Late payment interest may be charged at the rate permissible under applicable Indian law. TDS deductions shall be made in accordance with the Income Tax Act 1961.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Scope of Work', section_content: ``, is_locked: false, is_required: false, page_break_before: true },
    ], [IND_CONFIDENTIALITY, IND_DATA_PROTECTION, IND_ANTI_BRIBERY, IND_INTELLECTUAL_PROPERTY, IND_LIMITATION_OF_LIABILITY, IND_FORCE_MAJEURE, IND_DISPUTE_RESOLUTION, IND_TERMINATION, IND_GOVERNING_LAW]),
  },

  {
    contract_type: 'SOW',
    label: 'Statement of Work (Indian Law)',
    contract_title: 'Statement of Work',
    currency_code: 'INR',
    preamble: `THIS STATEMENT OF WORK ("SOW") is issued pursuant to the Master Services Agreement between the parties (or as a standalone agreement) and sets out the specific services, deliverables, timelines, and commercial terms agreed. This SOW is enforceable under the Indian Contract Act 1872.`,
    sections: buildIndianSections([
      { section_title: 'Project Overview', section_content: `[EDITABLE – Describe the project, objectives, and background.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Scope of Work', section_content: ``, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Deliverables', section_content: `[EDITABLE – List all deliverables with acceptance criteria.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Timeline and Milestones', section_content: `[EDITABLE – Set out the project schedule and key milestone dates.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Fees, GST, and Payment Schedule', section_content: `[EDITABLE – Specify fees including applicable GST (CGST/SGST/IGST), invoicing milestones, and payment terms. TDS applicability under the Income Tax Act 1961 to be noted.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Change Control', section_content: `Any change to scope, deliverables, timeline, or fees must be agreed in a signed Change Request before implementation. The parties shall agree on any impact on timeline and fees prior to proceeding.`, is_locked: false, is_required: false, page_break_before: false },
    ], [IND_DATA_PROTECTION, IND_LIMITATION_OF_LIABILITY, IND_FORCE_MAJEURE, IND_GOVERNING_LAW]),
  },

  {
    contract_type: 'NDA',
    label: 'Non-Disclosure Agreement (Indian Law)',
    contract_title: 'Non-Disclosure Agreement',
    currency_code: 'INR',
    preamble: `THIS NON-DISCLOSURE AGREEMENT ("Agreement") is entered into for the purpose of protecting Confidential Information exchanged in connection with the Permitted Purpose. This Agreement is enforceable under the Indian Contract Act 1872. The parties acknowledge that Confidential Information remains the property of the Disclosing Party.`,
    sections: buildIndianSections([
      { section_title: 'Permitted Purpose', section_content: `[EDITABLE – Define the specific purpose for which Confidential Information may be used (e.g., evaluation of a potential business relationship, technology collaboration, due diligence).]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Obligations of Receiving Party', section_content: `The Receiving Party shall: (a) hold Confidential Information in strict confidence; (b) use it solely for the Permitted Purpose; (c) restrict disclosure to employees or advisors bound by equivalent obligations; (d) immediately notify the Disclosing Party of any unauthorised disclosure; and (e) upon request, promptly return or certifiably destroy all materials containing Confidential Information.`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Exclusions from Confidentiality', section_content: `Obligations shall not apply to information that: (a) is or becomes publicly available without breach of this Agreement; (b) was lawfully known to the Receiving Party before disclosure; (c) is independently developed by the Receiving Party without use of Confidential Information; or (d) is required to be disclosed by Indian law, court order, or regulatory authority, with prompt prior notice where permissible.`, is_locked: true, is_required: true, page_break_before: false },
      { section_title: 'Scope of Work', section_content: ``, is_locked: false, is_required: false, page_break_before: false },
      { section_title: 'Duration', section_content: `[EDITABLE – Specify the confidentiality term (e.g., 2 years, 5 years, or indefinitely for trade secrets protected under the Indian Trade Secrets framework).]`, is_locked: false, is_required: true, page_break_before: false },
    ], [IND_DATA_PROTECTION, IND_DISPUTE_RESOLUTION, IND_GOVERNING_LAW]),
  },

  {
    contract_type: 'WORK_ORDER',
    label: 'Work Order (Indian Law)',
    contract_title: 'Work Order',
    currency_code: 'INR',
    preamble: `THIS WORK ORDER is issued by the Client to the Service Provider and constitutes a binding contract under the Indian Contract Act 1872 for the specific work described herein.`,
    sections: buildIndianSections([
      { section_title: 'Work Description', section_content: `[EDITABLE – Describe the specific work, technical specifications, and standards. Reference applicable BIS (Bureau of Indian Standards) standards where applicable.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Scope of Work', section_content: ``, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Location and Health & Safety', section_content: `[EDITABLE – Specify work location (on-site/remote) and applicable health and safety obligations under the Factories Act 1948, Building and Other Construction Workers Act 1996, or other applicable Indian labour safety laws.]`, is_locked: false, is_required: false, page_break_before: false },
      { section_title: 'Schedule', section_content: `[EDITABLE – Set out start date, completion date, and interim deadlines.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Price, GST, and Payment', section_content: `[EDITABLE – Specify fixed price or time-and-materials rate, applicable GST (with HSN/SAC codes), and payment terms. TDS deductions applicable under the Income Tax Act 1961 to be specified.]`, is_locked: false, is_required: true, page_break_before: false },
    ], [IND_LIMITATION_OF_LIABILITY, IND_FORCE_MAJEURE, IND_DISPUTE_RESOLUTION, IND_GOVERNING_LAW]),
  },

  {
    contract_type: 'MAINTENANCE',
    label: 'Maintenance Agreement (Indian Law)',
    contract_title: 'Maintenance and Support Agreement',
    currency_code: 'INR',
    preamble: `THIS MAINTENANCE AND SUPPORT AGREEMENT sets out the terms on which the Service Provider provides ongoing maintenance and support services for the systems, software, or equipment described herein. This Agreement is governed by the Indian Contract Act 1872 and, where applicable, the Information Technology Act 2000.`,
    sections: buildIndianSections([
      { section_title: 'Services Description', section_content: `[EDITABLE – Define the systems, software, or equipment covered; type of maintenance (preventive/corrective/adaptive); and exclusions from scope.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Scope of Work', section_content: ``, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Service Levels', section_content: `[EDITABLE – Specify response times, resolution targets, availability commitments (SLAs), and service credits for SLA failures.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Term and Renewal', section_content: `[EDITABLE – Specify initial term, auto-renewal provisions, and notice period for termination. Consumer protection obligations under the Consumer Protection Act 2019 to be observed where applicable.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Fees, GST, and Invoicing', section_content: `[EDITABLE – Specify maintenance fees, applicable GST (SAC code for maintenance services), invoicing frequency, and payment terms.]`, is_locked: false, is_required: true, page_break_before: false },
    ], [IND_DATA_PROTECTION, IND_LIMITATION_OF_LIABILITY, IND_FORCE_MAJEURE, IND_TERMINATION, IND_GOVERNING_LAW]),
  },

  {
    contract_type: 'CONSULTING',
    label: 'Consulting Agreement (Indian Law)',
    contract_title: 'Consulting Agreement',
    currency_code: 'INR',
    preamble: `THIS CONSULTING AGREEMENT is entered into between the Consultant and the Client for the provision of independent consulting services. The Consultant acts as an independent contractor and not as an employee, agent, or partner of the Client. The parties confirm compliance with applicable Indian employment and tax laws, including the Income Tax Act 1961 (TDS obligations), the Goods and Services Tax Act 2017 (GST on professional services), and the Code on Social Security 2020 where applicable.`,
    sections: buildIndianSections([
      { section_title: 'Services', section_content: `[EDITABLE – Describe the consulting services, areas of expertise engaged, and expected outputs or advisory deliverables.]`, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Scope of Work', section_content: ``, is_locked: false, is_required: true, page_break_before: false },
      { section_title: 'Independent Contractor Status', section_content: `The Consultant is an independent contractor and is solely responsible for: (a) all income tax liabilities under the Income Tax Act 1961, including advance tax payments; (b) GST registration and compliance under the Goods and Services Tax Act 2017 where applicable; (c) provident fund and ESIC contributions applicable to self-employed individuals; and (d) professional tax as applicable in the relevant state. The Consultant shall not hold out as an employee of the Client and the parties acknowledge that this Agreement does not create an employer–employee relationship under the Industrial Disputes Act 1947, the Contract Labour (Regulation and Abolition) Act 1970, or any other Indian employment legislation.`, is_locked: true, is_required: true, page_break_before: false },
      { section_title: 'Fees, GST, and TDS', section_content: `[EDITABLE – Specify the daily or hourly rate, expense reimbursement policy, invoicing procedure, GST applicable on professional services (SAC: 998311 or as applicable), and TDS rate under Section 194J of the Income Tax Act 1961.]`, is_locked: false, is_required: true, page_break_before: false },
    ], [IND_CONFIDENTIALITY, IND_DATA_PROTECTION, IND_ANTI_BRIBERY, IND_INTELLECTUAL_PROPERTY, IND_LIMITATION_OF_LIABILITY, IND_DISPUTE_RESOLUTION, IND_TERMINATION, IND_GOVERNING_LAW]),
  },
];

export const getIndianTemplate = (contractType: ContractType): ContractTemplate | undefined =>
  INDIAN_CONTRACT_TEMPLATES.find(t => t.contract_type === contractType);
