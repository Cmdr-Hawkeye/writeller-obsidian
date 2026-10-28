import { Notice } from 'obsidian';

/** Lets the host paint first and shows a neutral indicator only if real storage work takes longer. */
export async function withActivity<T>(message: string, work: () => Promise<T>): Promise<T> {
  const feedback: { notice?: Notice } = {};
  const timer = window.setTimeout(() => { feedback.notice = new Notice(message, 0); }, 250);
  try { await new Promise<void>(resolve => window.setTimeout(resolve, 0)); return await work(); }
  finally { window.clearTimeout(timer); feedback.notice?.hide(); }
}
