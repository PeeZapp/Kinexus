import { Image, StyleSheet } from 'react-native';

const MARK = require('../../../assets/images/icon.png');

/** App icon: cream K on a black circle, the same mark as the installed app. */
export function AppMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={MARK}
      accessible={false}
      style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: '#FDF5E8',
  },
});
