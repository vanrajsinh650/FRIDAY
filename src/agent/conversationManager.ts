import { ConversationState, ConversationTurn } from './types';

class ConversationManagerClass {
  private state: ConversationState = {
    turns: [],
    activeApp: undefined,
    activeEntity: undefined,
    recentSearchQuery: undefined,
    recentContact: undefined,
  };

  addTurn(role: 'user' | 'assistant', content: string, targetApp?: string, entities?: Record<string, string>): void {
    this.state.turns.push({
      role,
      content,
      timestamp: Date.now(),
      targetApp,
      entities,
    });

    if (this.state.turns.length > 20) {
      this.state.turns = this.state.turns.slice(-20);
    }

    if (targetApp) {
      this.state.activeApp = targetApp;
    }
    if (entities?.searchQuery) {
      this.state.recentSearchQuery = entities.searchQuery;
    }
    if (entities?.contact) {
      this.state.recentContact = entities.contact;
    }
  }

  getState(): ConversationState {
    return { ...this.state };
  }

  getActiveApp(): string | undefined {
    return this.state.activeApp;
  }

  getRecentSearchQuery(): string | undefined {
    return this.state.recentSearchQuery;
  }

  getRecentContact(): string | undefined {
    return this.state.recentContact;
  }

  clear(): void {
    this.state = {
      turns: [],
      activeApp: undefined,
      activeEntity: undefined,
      recentSearchQuery: undefined,
      recentContact: undefined,
    };
  }
}

export const ConversationManager = new ConversationManagerClass();
