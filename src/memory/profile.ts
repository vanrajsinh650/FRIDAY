import { MemoryStore } from './store';
import { UserProfile } from './types';

export class ProfileManager {
  static getProfile(): UserProfile {
    return MemoryStore.getProfile();
  }

  static setNickname(nickname: string): void {
    MemoryStore.updateProfile({ nickname });
  }
}
