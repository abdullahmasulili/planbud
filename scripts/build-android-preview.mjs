import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const privateFolder = resolve(root, '.private/android-signing');
const keystore = join(privateFolder, 'personal.p12');
const passwordFile = join(privateFolder, 'password');

/** Runs one local tool without exposing signing credentials through command arguments or output.
 * @param command Installed executable or generated Gradle wrapper.
 * @param args Explicit argument vector, never evaluated by a shell.
 * @param environment Scoped build environment including private signing values when needed.
 * @returns Completion; stops on launch/tool failure and leaves diagnostic ownership with the caller.
 * @throws When the tool cannot run or returns a nonzero exit status.
 */
const run = (command, args, environment = process.env) => {
  const result = spawnSync(command, args, { cwd: root, env: environment, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`Android build tool failed: ${command}`);
};

mkdirSync(privateFolder, { recursive: true, mode: 0o700 });
chmodSync(privateFolder, 0o700);
if (existsSync(keystore) !== existsSync(passwordFile))
  throw new Error(
    'Incomplete private signing identity. Recover the matching files before building; existing credentials will not be overwritten.',
  );
if (!existsSync(keystore)) {
  const password = randomBytes(32).toString('hex');
  writeFileSync(passwordFile, password, { flag: 'wx', mode: 0o600 });
  const result = spawnSync(
    'keytool',
    [
      '-genkeypair',
      '-keystore',
      keystore,
      '-storetype',
      'PKCS12',
      '-alias',
      'planbud-personal',
      '-keyalg',
      'RSA',
      '-keysize',
      '3072',
      '-validity',
      '10000',
      '-dname',
      'CN=Plan Bud Personal, O=Plan Bud, C=ID',
      '-storepass:env',
      'PLAN_BUD_SIGNING_PASSWORD',
      '-keypass:env',
      'PLAN_BUD_SIGNING_PASSWORD',
      '-noprompt',
    ],
    { cwd: root, env: { ...process.env, PLAN_BUD_SIGNING_PASSWORD: password }, encoding: 'utf8' },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      'Unable to create a private Android signing identity. Inspect local tool availability; no existing credentials were overwritten.',
    );
  chmodSync(keystore, 0o600);
  process.stdout.write(
    'Created a private local Android signing identity. Keep both ignored signing files for future app updates.\n',
  );
}
const password = readFileSync(passwordFile, 'utf8').trim();
if (!/^[a-f0-9]{64}$/.test(password)) throw new Error('Invalid private signing credential.');
run('pnpm', ['exec', 'expo', 'prebuild', '--platform', 'android', '--no-install']);
run(
  resolve(root, 'android/gradlew'),
  ['-p', resolve(root, 'android'), ':app:assembleRelease', '--max-workers=2'],
  {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
    EXPO_OFFLINE: '1',
    PLAN_BUD_KEYSTORE: keystore,
    PLAN_BUD_SIGNING_PASSWORD: password,
  },
);
const output = resolve(root, 'dist/android');
mkdirSync(output, { recursive: true });
const apk = join(output, 'plan-bud-preview.apk');
copyFileSync(resolve(root, 'android/app/build/outputs/apk/release/app-release.apk'), apk);
const digest = createHash('sha256').update(readFileSync(apk)).digest('hex');
writeFileSync(join(output, 'SHA256SUMS.txt'), `${digest}  plan-bud-preview.apk\n`);
process.stdout.write(
  'Standalone APK prepared in dist/android. Run the artifact scan and offline Android walkthrough before delivery.\n',
);
