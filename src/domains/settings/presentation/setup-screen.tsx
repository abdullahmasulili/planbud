import { useState } from 'react';
import { AppInput, ActionButton } from '@/shared/presentation/controls';
import { Checkbox, Text } from 'react-native-paper';
import type { Profile, ProfileService } from '../application/public';
import { Screen, FormMessage } from '@/shared/presentation/screen';
import { useOperation } from '@/shared/presentation/use-operation';
import { currencyFor } from '@/shared/domain/money';

/** Confirms currency explicitly before the first durable financial entry.
 * @param props Stable profile service, locale suggestion, and successful setup callback.
 * @param props.service Validated confirmation use case.
 * @param props.suggestedLocale Device number-format suggestion.
 * @param props.suggestedCurrency Supported device currency suggestion.
 * @param props.onConfirmed Receives the durably confirmed profile.
 * @param props.onImport Opens authenticated backup replacement before first-run currency selection.
 * @returns Offline first-run confirmation form.
 */
export const SetupScreen = ({
  service,
  suggestedLocale,
  suggestedCurrency,
  onConfirmed,
  onImport,
}: {
  service: ProfileService;
  suggestedLocale: string;
  suggestedCurrency: string;
  onConfirmed: (profile: Profile) => void;
  onImport?: () => void;
}) => {
  const [code, setCode] = useState(currencyFor(suggestedCurrency).ok ? suggestedCurrency : 'IDR');
  const [locale, setLocale] = useState(suggestedLocale);
  const [confirmed, setConfirmed] = useState(false);
  const operation = useOperation();
  const currency = currencyFor(code.trim().toUpperCase());
  /** Submits the explicit confirmation through the profile application boundary. */
  const submit = () => {
    if (!confirmed || !currency.ok) return;
    operation.run(
      async () =>
        await service.confirm({
          id: 'personal',
          currency: currency.value,
          locale: locale.trim(),
          appearance: 'system',
        }),
      onConfirmed,
    );
  };
  return (
    <Screen>
      <Text variant="headlineMedium">Your money, on your device</Text>
      <Text>
        Plan Bud works offline. Start by choosing the currency for all your budgets, transactions,
        and goals.
      </Text>
      <AppInput
        mode="outlined"
        label="Currency code"
        value={code}
        onChangeText={(value) => {
          setCode(value.toUpperCase());
          setConfirmed(false);
        }}
        autoCapitalize="characters"
        maxLength={3}
        error={!currency.ok}
        disabled={operation.busy}
      />
      <AppInput
        mode="outlined"
        label="Number format locale"
        value={locale}
        onChangeText={setLocale}
        autoCapitalize="none"
        maxLength={100}
        disabled={operation.busy}
      />
      <Text>
        Currency cannot be changed after confirmation. To use another currency, start a new local
        profile by clearing the existing data.
      </Text>
      <Checkbox.Item
        label={`I confirm ${currency.ok ? currency.value.code : 'this currency'} for my records`}
        status={confirmed ? 'checked' : 'unchecked'}
        onPress={() => setConfirmed(!confirmed)}
        disabled={operation.busy || !currency.ok}
        position="leading"
      />
      <FormMessage message={operation.message || (!currency.ok ? currency.error.message : '')} />
      <ActionButton
        mode="contained"
        onPress={submit}
        disabled={!confirmed || !currency.ok || operation.busy}
        loading={operation.busy}
        contentStyle={{ minHeight: 48 }}
      >
        Start planning
      </ActionButton>
      {onImport ? (
        <ActionButton mode="outlined" onPress={onImport} disabled={operation.busy}>
          Restore an existing backup
        </ActionButton>
      ) : null}
    </Screen>
  );
};
