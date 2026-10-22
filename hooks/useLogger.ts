import { useState, useCallback } from 'react';

/**
 * A custom hook to manage application logs.
 * It provides a centralized way to add timestamped messages and retrieve the log history.
 */
export const useLogger = () => {
  const [logs, setLogs] = useState<string[]>([]);

  /**
   * Adds a new message to the log queue with a timestamp.
   * @param message - The text to log.
   * @param data - Optional object to stringify and append (useful for debugging objects).
   */
  const logMessage = useCallback((message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    let formattedMessage = `[${timestamp}] ${message}`;
    
    if (data !== undefined) {
      try {
        const json = JSON.stringify(data, null, 2);
        formattedMessage += `\nData: ${json}`;
      } catch (e) {
        formattedMessage += `\n[Data serialization failed]`;
      }
    }

    // Console log for developer tools
    console.log(formattedMessage);

    // State update for UI display
    setLogs(prev => [...prev, formattedMessage]);
  }, []);

  /**
   * Clears all current logs.
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, logMessage, clearLogs };
};
