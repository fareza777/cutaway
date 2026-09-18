import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';

/** Stack screens stay mounted; foreground and route focus are both required. */
export function useScreenActive() {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    setForeground(AppState.currentState === 'active');
    return () => subscription.remove();
  }, []);
  return focused && foreground;
}
