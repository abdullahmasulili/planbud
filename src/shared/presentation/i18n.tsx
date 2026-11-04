import { createContext, useCallback, useContext } from 'react';
import { indonesian } from './translations/id';

/** Display locale only; financial records and recovery words are never translated. */
export const LocaleContext = createContext('en-US');

// Application policies return English explanations with values already inserted.
const templates = Object.entries(indonesian)
  .filter(([source]) => /\{\w+\}/.test(source))
  .map(([source, copy]) => ({
    pattern: new RegExp(
      '^' +
        source
          .split(/\{\w+\}/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('(.+?)') +
        '$',
    ),
    keys: Array.from(source.matchAll(/\{(\w+)\}/g), (match) => match[1] ?? ''),
    copy,
  }));

/** Resolves bundled copy and substitutes values without interpreting user content.
 * @param locale Saved or locally previewed display locale.
 * @param message English source copy with optional numbered placeholders.
 * @param values Display values inserted after translation.
 * @returns Offline localized copy; unknown source messages retain their original text.
 */
export const translate = (
  locale: string,
  message: string,
  values: Readonly<Record<string, string | number>> = {},
): string => {
  let copy = message;
  let substitutions = values;
  if (locale.toLowerCase().startsWith('id')) {
    copy = indonesian[message] ?? message;
    if (copy === message && !indonesian[message]) {
      for (const template of templates) {
        const match = template.pattern.exec(message);
        if (!match) continue;
        copy = template.copy;
        substitutions = Object.fromEntries(
          template.keys.map((key, index) => {
            const value = match[index + 1] ?? '';
            return [key, indonesian[value] ?? value];
          }),
        );
        break;
      }
    }
  }
  return copy.replace(/\{(\w+)\}/g, (match, key: string) => String(substitutions[key] ?? match));
};

/** Subscribes presentation copy to the current profile or onboarding preview locale.
 * @returns Locale and stable translator for labels, feedback and accessibility text.
 */
export const useI18n = () => {
  const locale = useContext(LocaleContext);
  const t = useCallback(
    (message: string, values?: Readonly<Record<string, string | number>>) =>
      translate(locale, message, values),
    [locale],
  );
  return { locale, t };
};
