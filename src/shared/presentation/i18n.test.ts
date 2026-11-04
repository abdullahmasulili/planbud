import { translate } from './i18n';
import { indonesian } from './translations/id';

it('translates copy offline and preserves inserted names, currency codes and recovery words', () => {
  expect(translate('id-ID', 'Step {0} of 4', { 0: 3 })).toBe('Langkah 3 dari 4');
  expect(translate('en-US', 'Step {0} of 4', { 0: 3 })).toBe('Step 3 of 4');
  expect(translate('id-ID', 'Edit goal {0}', { 0: 'Saved {0}' })).toBe('Ubah tujuan Saved {0}');
  expect(translate('id-ID', 'abandon ability able')).toBe('abandon ability able');
  expect(translate('en-GB', 'Overview')).toBe('Overview');
  expect(translate('id-ID', 'Remaining 100 minor units ÷ 2 inclusive months, rounded up.')).toBe(
    'Sisa 100 satuan terkecil ÷ 2 bulan inklusif, dibulatkan ke atas.',
  );
});

it('keeps every translated message and interpolation placeholder complete', () => {
  for (const [source, copy] of Object.entries(indonesian)) {
    expect(copy.trim()).not.toBe('');
    expect(copy.match(/\{\w+\}/g)?.sort() ?? []).toEqual(source.match(/\{\w+\}/g)?.sort() ?? []);
  }
});
