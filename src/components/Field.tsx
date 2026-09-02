import { Text, TextInput, View } from 'react-native';

import { colors, fonts, radius } from '../theme/tokens';

interface FieldProps extends React.ComponentProps<typeof TextInput> {
  label: string;
}

export function Field({ label, ...inputProps }: FieldProps) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: fonts.bodySemi,
          fontSize: 13,
          color: colors['text-soft'],
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors['muted-soft']}
        style={{
          backgroundColor: colors.card,
          borderWidth: 2,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontFamily: fonts.body,
          fontSize: 16,
          color: colors.text,
        }}
        {...inputProps}
      />
    </View>
  );
}
