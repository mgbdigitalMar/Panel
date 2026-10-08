import { forwardRef, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Eye, EyeOff, Calendar, Clock } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { FONTS } from '../../theme/tokens';
import { T } from './Text';
import { parseDate, toISODate, fmtDayShort } from '../../utils/format';

function FieldLabel({ label, required, children }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T size={13} weight="medium" color={colors.text2}>
          {label}{required ? <T size={13} color={colors.dangerFg}> *</T> : null}
        </T>
      ) : null}
      {children}
    </View>
  );
}

/** Text input from the design system: 52 dp, radius 16, accent focus ring. */
export const GlassInput = forwardRef(function GlassInput({
  label, value, onChangeText, secure, multiline, error, hint, required, style, inputStyle, rows = 3, ...rest
}, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);

  return (
    <View style={[{ gap: 6 }, style]}>
      <FieldLabel label={label} required={required}>
        <View style={{ position: 'relative', justifyContent: 'center' }}>
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secure && !show}
            multiline={multiline}
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
            accessibilityLabel={label}
            {...rest}
            style={[{
              minHeight: multiline ? 24 * rows + 24 : 52,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: error ? colors.dangerFg : focused ? colors.accent : colors.inputBorder,
              backgroundColor: colors.inputBg,
              color: colors.text,
              fontFamily: FONTS.regular,
              fontSize: 16,
              paddingHorizontal: 16,
              paddingRight: secure ? 52 : 16,
              paddingTop: multiline ? 14 : 0,
              paddingBottom: multiline ? 14 : 0,
              textAlignVertical: multiline ? 'top' : 'center',
            }, inputStyle]}
          />
          {secure ? (
            <Pressable
              onPress={() => setShow((s) => !s)}
              accessibilityRole="button"
              accessibilityLabel={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              hitSlop={8}
              style={{ position: 'absolute', right: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              {show ? <EyeOff size={20} color={colors.text2} /> : <Eye size={20} color={colors.text2} />}
            </Pressable>
          ) : null}
        </View>
      </FieldLabel>
      {error ? <T size={13} color={colors.dangerFg}>{error}</T> : hint ? <T size={12.5} color={colors.text3}>{hint}</T> : null}
    </View>
  );
});

function PickerBox({ icon: Icon, text, placeholder, onPress, label }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        height: 52, borderRadius: 16, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBg,
        paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
      }}
    >
      <Icon size={18} color={colors.text3} />
      <T size={16} color={text ? colors.text : colors.muted} style={{ flex: 1 }} numberOfLines={1}>{text || placeholder}</T>
    </Pressable>
  );
}

/**
 * Date field. value/onChange use YYYY-MM-DD strings (what Supabase stores).
 */
export function DateField({ label, value, onChange, required, minimumDate, maximumDate, placeholder = 'Elegir fecha', style }) {
  const current = parseDate(value) || new Date();
  const min = minimumDate ? new Date(new Date(minimumDate).setHours(0, 0, 0, 0)) : undefined;

  const open = () => {
    if (Platform.OS === 'android') {
      const handleDate = (_event, selectedDate) => {
        if (selectedDate) {
          onChange(toISODate(selectedDate));
        }
      };
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate: min,
        maximumDate,
        onChange: handleDate,
        onValueChange: handleDate,
      });
    }
  };

  const handleIosChange = (_e, d) => {
    if (d) onChange(toISODate(d));
  };

  return (
    <View style={style}>
      <FieldLabel label={label} required={required}>
        {Platform.OS === 'android' ? (
          <PickerBox icon={Calendar} text={value ? fmtDayShort(value) : ''} placeholder={placeholder} onPress={open} label={label} />
        ) : (
          <DateTimePicker value={current} mode="date" display="compact" locale="es-ES" minimumDate={min} maximumDate={maximumDate}
            onChange={handleIosChange} onValueChange={handleIosChange} />
        )}
      </FieldLabel>
    </View>
  );
}

/** Time field. value/onChange use HH:MM strings. */
export function TimeField({ label, value, onChange, required, style }) {
  const [h, m] = String(value || '09:00').split(':').map(Number);
  const current = new Date();
  current.setHours(h || 0, m || 0, 0, 0);
  const fmt = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const open = () => {
    if (Platform.OS === 'android') {
      const handleTime = (_event, selectedTime) => {
        if (selectedTime) {
          onChange(fmt(selectedTime));
        }
      };
      DateTimePickerAndroid.open({
        value: current,
        mode: 'time',
        is24Hour: true,
        onChange: handleTime,
        onValueChange: handleTime,
      });
    }
  };

  const handleIosChange = (_e, d) => {
    if (d) onChange(fmt(d));
  };

  return (
    <View style={style}>
      <FieldLabel label={label} required={required}>
        {Platform.OS === 'android' ? (
          <PickerBox icon={Clock} text={value} placeholder="--:--" onPress={open} label={label} />
        ) : (
          <DateTimePicker value={current} mode="time" display="compact" is24Hour locale="es-ES"
            onChange={handleIosChange} onValueChange={handleIosChange} />
        )}
      </FieldLabel>
    </View>
  );
}

export { FieldLabel };
