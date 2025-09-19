import type { LogLevel, LogEntry } from '../../types/logger';

interface StoredLog {
  level: LogLevel;
  message: string;
  timestamp: string;
}

export async function store(level: LogLevel, message: string): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['debugLogs']);
    const logs: StoredLog[] = result.debugLogs || [];
    
    logs.push({ 
      level, 
      message, 
      timestamp: new Date().toISOString() 
    });
    
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    
    await chrome.storage.local.set({ debugLogs: logs });
  } catch (e) {
    console.error('Failed to store log:', e);
  }
}