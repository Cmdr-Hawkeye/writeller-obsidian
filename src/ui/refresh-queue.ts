/** Coalesces overlapping refresh requests; one trailing pass observes changes during current work. */
export class RefreshQueue {
  private running: Promise<void> | null = null;
  private again = false;
  /** Accepts one replaceable renderer; errors remain visible to every waiting caller. */
  constructor(private readonly work: () => Promise<void>) {}
  /** Shares expensive work instead of starting a complete project reconstruction per event. */
  request(): Promise<void> {
    this.again = true;
    return this.running ??= Promise.resolve().then(() => this.drain()).finally(() => { this.running = null; });
  }
  /** Runs at most one task at a time and handles events received while the task awaited IO. */
  private async drain(): Promise<void> { while (this.again) { this.again = false; await this.work(); } }
}
