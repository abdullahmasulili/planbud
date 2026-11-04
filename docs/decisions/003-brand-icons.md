# Buddy Wallet Android identity

No external ticket. UI-011 follows the user's selected Buddy Wallet concept.

Use the wallet's alpha silhouette for adaptive and Android 13+ monochrome launcher icons. The full-color fallback and notification large icon use the same white mark on brand blue. Notification small icons use white pixels with alpha cutouts, rather than a colored square that Android would render as a solid block.

Expo SDK 58 supports foreground, monochrome, and background color assets. A small CNG plugin supplies the night-qualified background because app config has no Android light/dark background pair. The Expo icon generator's `iconBackground` resource is version-dependent and must be checked when upgrading Expo.

Install `expo-notifications` through `pnpm exec expo install expo-notifications --pnpm` to use its supported small/large icon configuration. No application scheduling, permission request, push token registration, or notification handler is added. The native package includes Firebase Messaging; the offline plugin disables automatic messaging initialization and analytics collection, and continues removing release internet/network permissions. No Firebase configuration or remote service is provisioned. Expo's installer added exact-version age exceptions for the selected SDK package and its Expo dependencies; the existing supply-chain checks remain enabled.

Sources:

- [Expo SDK 58 app configuration](https://docs.expo.dev/versions/v58.0.0/config/app/)
- [Expo SDK 58 notification icon configuration](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/#configurable-properties)
- [Android adaptive icon safe zone and themed icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)
- [Prevent Firebase messaging auto-initialization](https://firebase.google.com/docs/cloud-messaging/android/get-started#prevent-auto-initialization)
