# Offline currency precision

`src/shared/domain/currencies.json` contains ISO 4217 currency codes with numeric minor-unit exponents, distilled from the [official SIX maintenance list](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml) on 2026-10-20. Precious-metal and accounting units without numeric minor units are not selectable monetary currencies.

Amounts use integer minor units and exact decimal-string parsing. The runtime supplies locale separators and display formatting; it does not determine currency validity. This avoids treating an arbitrary three-letter string as a real currency and keeps first-launch validation offline.

Currency table updates require reviewing the official list and rerunning currency/backup compatibility tests. Existing profiles must not be silently relabeled or converted when the reference data changes.

The onboarding dropdown bundles English currency names in `src/domains/settings/presentation/currency-names.json`, captured from Node 24 ICU display names. IDR uses the requested label “Indonesia Rupiah”; XAD uses SIX's “Arab Accounting Dinar”. Names are display metadata, shared across both interface languages, and never change stored currency codes or exponents. A coverage test requires a name for every selectable code. Update the name table alongside the currency reference; Android does not need `Intl.DisplayNames` or network access to open the picker.
