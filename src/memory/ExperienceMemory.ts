import { FridayTask, Goal } from '../task/types';

export interface ExperienceRecord {
  experienceId: string;
  goalPattern: string;
  contextSummary: string;
  actionSequence: string[];
  evidenceDescription: string;
  successCount: number;
  lastUsedAt: number;
  createdAt: number;
}

export class ExperienceMemory {
  private static instance: ExperienceMemory | null = null;
  private experiences: Map<string, ExperienceRecord> = new Map();

  static getInstance(): ExperienceMemory {
    if (!this.instance) {
      this.instance = new ExperienceMemory();
    }
    return this.instance;
  }

  private normalizePattern(goalText: string): string {
    const lower = goalText.toLowerCase().trim();
    if (/\b(?:volume|loud|sound|mute)\b/.test(lower)) return 'DEVICE_VOLUME_CONTROL';
    if (/\b(?:brightness|dim|light)\b/.test(lower)) return 'DEVICE_BRIGHTNESS_CONTROL';
    if (/\b(?:torch|flashlight)\b/.test(lower)) return 'DEVICE_TORCH_CONTROL';
    if (/\b(?:remind|reminder|alarm)\b/.test(lower)) return 'SCHEDULE_REMINDER_ALARM';
    if (/\b(?:open|launch)\s+([a-z0-9]+)/.test(lower)) {
      const match = /\b(?:open|launch)\s+([a-z0-9]+)/.exec(lower);
      return `LAUNCH_APP:${match ? match[1] : 'unknown'}`;
    }
    if (/\b(?:what|battery|time|date|status)\b/.test(lower)) return 'QUERY_DEVICE_STATE';
    return `GENERAL:${lower.split(' ').slice(0, 3).join('_')}`;
  }

  recordExperience(task: FridayTask): void {
    if (task.status !== 'COMPLETED' || task.actions.length === 0) return;

    const pattern = this.normalizePattern(task.goal.objective);
    const existing = this.experiences.get(pattern);

    const actionSeq = task.actions.map((a) => a.capabilityName);
    const evidenceSummary = task.evidence.map((e) => e.description).join(', ') || 'Task verified';

    if (existing) {
      existing.actionSequence = actionSeq;
      existing.evidenceDescription = evidenceSummary;
      existing.successCount++;
      existing.lastUsedAt = Date.now();
    } else {
      this.experiences.set(pattern, {
        experienceId: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        goalPattern: pattern,
        contextSummary: `Category: ${task.goal.category}`,
        actionSequence: actionSeq,
        evidenceDescription: evidenceSummary,
        successCount: 1,
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
      });
    }
  }

  findExperience(goal: Goal): ExperienceRecord | null {
    const pattern = this.normalizePattern(goal.objective);
    return this.experiences.get(pattern) || null;
  }

  formatForPrompt(goal: Goal): string {
    const exp = this.findExperience(goal);
    if (!exp) return '';

    return [
      '### [EXPERIENCE MEMORY HINT]',
      `- Prior successful strategy (${exp.successCount}x verified): Used capabilities [${exp.actionSequence.join(' ➔ ')}]`,
      `- Note: Validate current screen state before executing. Adapt if reality changed.`,
    ].join('\n');
  }

  clear(): void {
    this.experiences.clear();
  }
}
