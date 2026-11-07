/**
 * Autonomous CRM Agents & Copilot Module
 * Client Settings & Module Entitlement Service
 */

import { AgentModuleSettings } from '../types';
import { DEFAULT_AGENT_SETTINGS, STORAGE_KEYS } from '../config';
import { clientConfig } from '../../../config/client.config';

class CopilotSettingsService {
  private cachedSettings: AgentModuleSettings | null = null;
  private listeners: Set<(settings: AgentModuleSettings) => void> = new Set();

  constructor() {
    // Listen to storage events from other tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEYS.SETTINGS) {
          this.cachedSettings = null;
          this.notifyListeners();
        }
      });
    }
  }

  /**
   * Get client-specific storage key so settings can be isolated per client if desired.
   */
  private getStorageKey(): string {
    const clientId = clientConfig?.clientId || 'default';
    return `${STORAGE_KEYS.SETTINGS}_${clientId}`;
  }

  /**
   * Load active settings. Defaults to clientConfig activeModules.aiAgents if not customized.
   */
  public getSettings(): AgentModuleSettings {
    if (this.cachedSettings) {
      return { ...this.cachedSettings };
    }

    if (typeof window === 'undefined') {
      return { ...DEFAULT_AGENT_SETTINGS };
    }

    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        const validEnabled: boolean =
          typeof parsed.enabled === 'boolean'
            ? parsed.enabled
            : ((clientConfig?.activeModules as any)?.aiAgents ?? true);

        const loadedSettings: AgentModuleSettings = {
          ...DEFAULT_AGENT_SETTINGS,
          ...parsed,
          enabled: validEnabled,
          planTier: parsed.planTier || DEFAULT_AGENT_SETTINGS.planTier,
          thresholds: {
            ...DEFAULT_AGENT_SETTINGS.thresholds,
            ...(parsed.thresholds || {}),
          },
          agents: {
            ...DEFAULT_AGENT_SETTINGS.agents,
            ...(parsed.agents || {}),
          },
          autoPilot: {
            ...DEFAULT_AGENT_SETTINGS.autoPilot,
            ...(parsed.autoPilot || {}),
          },
          notifications: {
            ...DEFAULT_AGENT_SETTINGS.notifications,
            ...(parsed.notifications || {}),
          },
        };
        this.cachedSettings = loadedSettings;
        return { ...loadedSettings };
      }
    } catch (e) {
      console.warn('Failed to parse stored copilot settings:', e);
    }

    // Default: inherit master toggle from clientConfig.activeModules if present
    const isClientModuleActive = (clientConfig?.activeModules as any)?.aiAgents ?? true;
    const initial: AgentModuleSettings = {
      ...DEFAULT_AGENT_SETTINGS,
      enabled: isClientModuleActive,
      clientName: clientConfig?.clientName || DEFAULT_AGENT_SETTINGS.clientName,
    };

    this.cachedSettings = initial;
    return { ...initial };
  }

  /**
   * Check if the Agent Copilot module is enabled for this client.
   * If false, the feature is disabled (e.g. client has not paid for the add-on).
   */
  public isModuleEnabled(): boolean {
    return this.getSettings().enabled;
  }

  /**
   * Toggle the module on or off for this client.
   */
  public setModuleEnabled(enabled: boolean): void {
    this.updateSettings({ enabled });
  }

  /**
   * Update full or partial settings.
   */
  public updateSettings(updates: Partial<AgentModuleSettings>): AgentModuleSettings {
    const current = this.getSettings();
    const updated: AgentModuleSettings = {
      ...current,
      ...updates,
      thresholds: {
        ...current.thresholds,
        ...(updates.thresholds || {}),
      },
      agents: {
        ...current.agents,
        ...(updates.agents || {}),
      },
      autoPilot: {
        ...current.autoPilot,
        ...(updates.autoPilot || {}),
      },
      notifications: {
        ...current.notifications,
        ...(updates.notifications || {}),
      },
    };

    this.cachedSettings = updated;

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(updated));
        // Also fire window event for reactive UI components
        window.dispatchEvent(
          new CustomEvent(STORAGE_KEYS.EVENT_NAME, {
            detail: updated,
          })
        );
      }
    } catch (e) {
      console.error('Failed to save copilot settings:', e);
    }

    this.notifyListeners();
    return { ...updated };
  }

  /**
   * Reset settings to template defaults.
   */
  public resetToDefaults(): AgentModuleSettings {
    const initial: AgentModuleSettings = {
      ...DEFAULT_AGENT_SETTINGS,
      enabled: (clientConfig?.activeModules as any)?.aiAgents ?? true,
      clientName: clientConfig?.clientName || DEFAULT_AGENT_SETTINGS.clientName,
    };
    this.cachedSettings = initial;
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.getStorageKey());
        window.dispatchEvent(
          new CustomEvent(STORAGE_KEYS.EVENT_NAME, {
            detail: initial,
          })
        );
      }
    } catch (e) {
      console.error('Failed to clear copilot settings:', e);
    }
    this.notifyListeners();
    return { ...initial };
  }

  /**
   * Subscribe to settings changes.
   */
  public subscribe(callback: (settings: AgentModuleSettings) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    const current = this.getSettings();
    this.listeners.forEach((cb) => {
      try {
        cb(current);
      } catch (err) {
        console.error('Error in copilot settings listener:', err);
      }
    });
  }
}

export const copilotSettingsService = new CopilotSettingsService();
export default copilotSettingsService;
