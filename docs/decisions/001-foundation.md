# Foundation decisions

The app targets Android with Expo SDK 58, React 19.3, React Native 0.88, Node 24.10.0, and pnpm 12.3.4. Expo-compatible dependencies are installed with Expo CLI and retained in the lockfile.

SQLite owns financial records. Presentation state uses scoped Zustand stores supplied through React Context. Pure rules and application ports are grouped by business domain; native adapters are injected by composition.

Jest 30 with jest-expo runs domain, application, and component tests. Native Android checks verify actual SQLite, cryptography, file access, and lifecycle behavior rather than treating mocks as native evidence.

Optional build scripts for the exact installed versions of Parcel Watcher and unrs-resolver are denied in pnpm configuration. Their prebuilt packages are verified through lint/test execution; no dependency script is implicitly approved and supply-chain checks remain enabled.

The Jest configuration is the only authored CommonJS configuration exception. Promise observation is restricted to the documented operation launcher; ordinary code uses async/await. Repository-relative references are required in authored and delivered artifacts.
