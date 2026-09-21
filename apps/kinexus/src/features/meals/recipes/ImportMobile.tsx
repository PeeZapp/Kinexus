import { ScrollView } from 'react-native';

import {
  ImportChrome,
  ImportExtractCard,
  ImportFieldsCard,
  importStyles,
  type ImportRecipeViewProps,
} from '@/src/features/meals/recipes/ImportShared';

export function ImportMobile(props: ImportRecipeViewProps) {
  return (
    <ScrollView style={importStyles.root} contentContainerStyle={importStyles.content} keyboardShouldPersistTaps="handled">
      <ImportChrome
        desktop={false}
        error={props.error}
        blockedReason={props.blockedReason}
        online={props.online}
        busy={props.busy}
        onSave={props.onSave}>
        <ImportExtractCard {...props} />
        <ImportFieldsCard desktop={props.desktop} form={props.form} setForm={props.setForm} />
      </ImportChrome>
    </ScrollView>
  );
}
