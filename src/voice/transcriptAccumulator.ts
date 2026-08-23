export interface TranscriptTurn {
  turnId: string;
  rawPartials: string[];
  stableTranscript: string;
  finalTranscript: string;
  confidence: number;
  durationMs: number;
  language: string;
  endpointReason: string;
  timestamps: {
    speechStart: number;
    speechEnd: number;
    finalReceived: number;
  };
}

export class TranscriptAccumulator {
  private currentTurn: TranscriptTurn | null = null;
  private history: TranscriptTurn[] = [];

  startTurn(): void {
    this.currentTurn = {
      turnId: `turn_${Date.now()}`,
      rawPartials: [],
      stableTranscript: '',
      finalTranscript: '',
      confidence: 0,
      durationMs: 0,
      language: 'en-IN',
      endpointReason: '',
      timestamps: { speechStart: Date.now(), speechEnd: 0, finalReceived: 0 },
    };
  }

  addPartial(text: string): void {
    if (!this.currentTurn) return;
    this.currentTurn.rawPartials.push(text);
    if (text.length > this.currentTurn.stableTranscript.length) {
      this.currentTurn.stableTranscript = text;
    }
  }

  finalize(finalText: string, confidence: number, endpointReason: string): TranscriptTurn {
    if (!this.currentTurn) {
      // Safety fallback if finalize called without startTurn
      this.startTurn();
    }
    this.currentTurn!.finalTranscript = finalText;
    this.currentTurn!.confidence = confidence;
    this.currentTurn!.endpointReason = endpointReason;
    this.currentTurn!.timestamps.speechEnd = Date.now();
    this.currentTurn!.timestamps.finalReceived = Date.now();
    this.currentTurn!.durationMs = Date.now() - this.currentTurn!.timestamps.speechStart;

    const completed = { ...this.currentTurn! };
    this.history.push(completed);
    if (this.history.length > 50) this.history = this.history.slice(-50);
    this.currentTurn = null;
    return completed;
  }

  getHistory(): TranscriptTurn[] { return [...this.history]; }
  getCurrentPartials(): string[] { return this.currentTurn?.rawPartials || []; }
  isActive(): boolean { return this.currentTurn !== null; }
}
