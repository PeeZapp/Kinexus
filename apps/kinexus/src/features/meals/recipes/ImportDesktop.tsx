import { ScrollView, View } from 'react-native';

import {
  ImportChrome,
  ImportExtractCard,
  ImportFieldsCard,
  importStyles,
  type ImportRecipeViewProps,
} from '@/src/features/meals/recipes/ImportShared';

export function ImportDesktop(props: ImportRecipeViewProps) {
  return (
    <ScrollView style={importStyles.root} contentContainerStyle={[importStyles.content, importStyles.contentDesktop]} keyboardShouldPersistTaps="handled">
      <ImportChrome
        desktop
        error={props.error}
        blockedReason={props.blockedReason}
        online={props.online}
        busy={props.busy}
        onSave={props.onSave}>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          <View style={{ width: 340, gap: 12 }}>
            <ImportExtractCard {...props} />
          </View>
          <View style={{ flex: 1, gap: 12 }}>
            <ImportFieldsCard {...props} />
          </View>
        </View>
      </ImportChrome>
    </ScrollView>
  );
}
