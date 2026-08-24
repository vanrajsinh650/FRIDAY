import { MemoryStore } from './store';
import { ContactProfile, UserProfile } from './types';

export class ProfileManager {
  static getProfile(): UserProfile {
    return MemoryStore.getProfile();
  }

  static async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    await MemoryStore.updateProfile(updates);
  }

  static setNickname(nickname: string): void {
    MemoryStore.updateProfile({ nickname });
  }

  static async setPreferredMusicApp(app: string): Promise<void> {
    await MemoryStore.updateProfile({ preferredMusicApp: app });
    await MemoryStore.setFavoriteApp('music', app);
  }

  static async setPreferredMapApp(app: string): Promise<void> {
    await MemoryStore.updateProfile({ preferredMapApp: app });
    await MemoryStore.setFavoriteApp('maps', app);
  }

  static async setPreferredLanguage(preferredLanguage: string): Promise<void> {
    await MemoryStore.updateProfile({ preferredLanguage });
  }

  static async addContact(contact: ContactProfile): Promise<void> {
    await MemoryStore.addOrUpdateContact(contact);
  }

  static getContact(nameOrRelation: string): ContactProfile | undefined {
    return MemoryStore.getContact(nameOrRelation);
  }

  static async setFavoriteApp(category: string, app: string): Promise<void> {
    await MemoryStore.setFavoriteApp(category, app);
  }

  static getFavoriteApp(category: string): string | undefined {
    return MemoryStore.getFavoriteApp(category);
  }

  static getSystemPreferences(): Record<string, any> {
    return MemoryStore.getSystemPreferences();
  }

  static async updateSystemPreferences(prefs: Record<string, any>): Promise<void> {
    await MemoryStore.updateSystemPreferences(prefs);
  }
}
