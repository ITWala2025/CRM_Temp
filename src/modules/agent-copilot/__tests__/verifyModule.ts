/**
 * Automated Verification Script for Autonomous Copilot Module
 */

import {
  copilotSettingsService,
  agentEngine,
  agentAuditService,
  agentActionService,
  DEFAULT_AGENT_SETTINGS,
  AGENT_ROSTER,
} from '../index';

async function runTests() {
  console.log('--- 1. Testing Default Configurations & Agent Roster ---');
  if (!DEFAULT_AGENT_SETTINGS) throw new Error('DEFAULT_AGENT_SETTINGS missing');
  if (Object.keys(AGENT_ROSTER).length !== 5) {
    throw new Error(`Expected 5 agents, found ${Object.keys(AGENT_ROSTER).length}`);
  }
  console.log('✓ 5 Agents verified:', Object.keys(AGENT_ROSTER).join(', '));

  console.log('\n--- 2. Testing Settings Entitlement Service ---');
  const initialSettings = copilotSettingsService.getSettings();
  console.log('✓ Initial settings loaded. Enabled:', initialSettings.enabled);

  copilotSettingsService.setModuleEnabled(false);
  if (copilotSettingsService.isModuleEnabled() !== false) {
    throw new Error('Failed to toggle module OFF');
  }
  console.log('✓ Module toggled OFF successfully');

  copilotSettingsService.setModuleEnabled(true);
  if (copilotSettingsService.isModuleEnabled() !== true) {
    throw new Error('Failed to toggle module ON');
  }
  console.log('✓ Module toggled ON successfully');

  console.log('\n--- 3. Testing Multi-Agent Diagnostics Engine ---');
  const allInsights = await agentEngine.runAllAgents();
  console.log(`✓ Multi-Agent scan completed. Found ${allInsights.length} actionable insights.`);
  for (const ins of allInsights) {
    console.log(`  - [${ins.agentName}] [${ins.severity}] ${ins.title}`);
  }

  console.log('\n--- 4. Testing Audit Service & Governance Stream ---');
  const initialAudit = agentAuditService.getAuditRecords();
  console.log(`✓ Current audit stream has ${initialAudit.length} records`);

  const newAudit = agentAuditService.recordAction({
    agentName: 'CollectionsAgent',
    actionType: 'DRAFT_CREATED',
    entityType: 'invoice',
    entityId: 'inv-test-101',
    payload: { amount: 3500 },
    status: 'APPLIED',
    actorName: 'Automated Test Runner',
    resolutionNotes: 'Dispatched test payment follow-up',
  });
  console.log('✓ Recorded new audit action:', newAudit.id);

  const csv = agentAuditService.exportToCsv();
  if (!csv.includes('CollectionsAgent')) throw new Error('CSV export missing record');
  console.log('✓ Exported CSV successfully (length: ' + csv.length + ' chars)');

  const json = agentAuditService.exportToJson();
  const parsedJson = JSON.parse(json);
  if (!Array.isArray(parsedJson) || parsedJson.length === 0) throw new Error('JSON export invalid');
  console.log('✓ Exported JSON successfully (count: ' + parsedJson.length + ' records)');

  console.log('\n=== ALL MODULE INTEGRATION CHECKS PASSED ===');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

