# Plan Bud

An Android-only personal budget planner with local SQLite records, Material Design 3, bundled Plus Jakarta Sans, and light, dark and system color schemes. Plan monthly category limits, track income and expenses, record goal contributions, and review explainable goal allocations before applying changes.

Encrypted `.planbud` backups require the file and its original generated 12-word recovery phrase. Import validates and previews a backup before replacing local records. Keep both safely: a lost phrase cannot be reset. The file format is documented; anyone possessing both the file and phrase can decrypt it with a compatible implementation.

The running app needs no account or network. The MVP's live database uses Android app-private storage; backup encryption does not encrypt that database. Actual checks and remaining release acceptance are recorded in [implementation verification](docs/engineering/verification.md).

## Development

Use Node from `.nvmrc` and pnpm 12.3.4.

```sh
pnpm install --frozen-lockfile
pnpm start
pnpm android
```

Native features require an Android development build. Install dependencies through `pnpm exec expo install <package>` so Expo chooses compatible versions. Generated Android files are not edited by hand.

## Engineering checks

```sh
pnpm check
```

The check command runs formatting, lint, typechecking, architectural boundaries, source portability, release policies, and tests. See [contributor guidance](CONTRIBUTING.md), the [documentation index](docs/README.md), and [engineering standards](docs/engineering/standards.md) for the required workflow.

The product's offline behavior must be verified on a standalone Android APK with the development server stopped. Jest mocks alone do not prove native persistence, cryptography, or recovery behavior.

## Personal Android APK

With Java 17 and the Android SDK configured locally:

```sh
pnpm android:preview
pnpm scan:release dist/android/plan-bud-preview.apk
```

The build uses Expo Continuous Native Generation and produces a signed standalone APK plus its checksum in `dist/android/`. The first build creates a private signing identity in the ignored `.private/android-signing/` folder. Preserve both files there securely for future updates; they are separate from the app's recovery phrase. Never commit or share them with the APK. A subsequent build reuses that identity and refuses to overwrite an incomplete pair.

EAS profiles are also provided for an explicitly configured Expo account. Local APK generation does not require an Apple account or an EAS subscription.
