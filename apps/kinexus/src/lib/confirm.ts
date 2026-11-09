import { Alert, Platform } from 'react-native';

/** Web-safe yes/no. react-native-web's Alert.alert is a no-op. */
export async function confirmAction(title: string, message?: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(message ? `${title}\n\n${message}` : title);
  }
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => settle(false) },
        { text: 'OK', onPress: () => settle(true) },
      ],
      { cancelable: true, onDismiss: () => settle(false) },
    );
  });
}

/** Resume gate used before starting another live session. */
export async function chooseResumeOrStartNew(): Promise<'resume' | 'start' | 'cancel'> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm('You have a workout in progress.\n\nOK = Resume it')) return 'resume';
    if (window.confirm('Start a new workout instead?')) return 'start';
    return 'cancel';
  }
  return new Promise((resolve) => {
    Alert.alert('You have a workout in progress', undefined, [
      { text: 'Resume', onPress: () => resolve('resume') },
      { text: 'Start new', onPress: () => resolve('start') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
    ]);
  });
}
