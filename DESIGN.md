# Plan Bud interface

Material Design 3 for Android. Personal records stay on this device. The source identity is the existing splash blue `#208AEF`; text-bearing primary roles use a darker tone for contrast. ENERGY 1, RHYTHM 1, MOTION 1.

| Role                     | Light                 | Dark                  |
| ------------------------ | --------------------- | --------------------- |
| Primary / on primary     | `#005EAD` / `#FFFFFF` | `#A3C9FF` / `#00315D` |
| Primary container / text | `#D4E3FF` / `#001C38` | `#004883` / `#D4E3FF` |
| Background / text        | `#F9FAFD` / `#191C20` | `#111318` / `#E2E2E9` |
| Surface / text           | `#F9FAFD` / `#191C20` | `#111318` / `#E2E2E9` |
| Surface variant / text   | `#E0E3EC` / `#424750` | `#424750` / `#C3C7D1` |
| Outline                  | `#73777E`             | `#8D9199`             |
| Error / on error         | `#BA1A1A` / `#FFFFFF` | `#FFB4AB` / `#690005` |

Plus Jakarta Sans is bundled at 400, 500, 600, and 700. Paper's semantic type scale supplies sizes and line heights. Use regular body text, medium labels, semibold section headings, and bold amounts sparingly. Router headers and native inputs use the same family. Preserve system font scaling.

Spacing follows 4, 8, 12, 16, 24, and 32 dp. Screen edges use 24 dp; related form controls use 16 dp gaps. Material shapes use 12 dp base roundness. Cards group a complete financial comparison or independent named plan. Use one visible primary action per form, 48 dp minimum targets, clear validation beside fields, and native back behavior. Large text must wrap rather than clip in fixed-height rows.

Status uses text alongside color. Errors explain how to recover; destructive actions require an explicit confirmation. Focus uses outlined inputs and native accessibility focus. No decorative entrance motion. Respect safe areas and keyboard visibility. Transaction history owns one virtualized scroll surface.

Font source: [Tokotype Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans). The bundled SIL Open Font License is in `assets/fonts/OFL.txt`. Native screenshots and contrast assertions are recorded in the verification document as they are executed.

## First launch

The four-step onboarding introduces PlanBud, explains protected recovery storage and requests consent, previews language/currency/theme, then offers Get started. A four-segment progress indicator and Back action retain local selections. Only Get started persists the profile. English and Indonesian copy is bundled offline; the profile locale owns language and number formatting. Existing drafts retain the decimal format they opened with. Offer a one-tap Indonesian rupiah (IDR) choice; show whole amounts such as Rp10.000 without zero decimals, and retain nonzero decimals such as Rp10.000,50.

The final step uses one requested completion animation: the mark rises from below the screen into the middle, bounces lightly, spins once, and reveals a check. This is the explicit exception to the no-entrance-motion rule, requested on 2026-11-04. It never loops. Reduced motion, including an unavailable preference read, shows the completed mark directly. Recovery words remain English BIP-39 words; ordinary user-entered names and notes are never translated.

## App identity

The approved Buddy Wallet is the app symbol, without a wordmark inside the icon. `assets/images/icon.png` is the full-color legacy and notification large icon. The transparent 1024 px adaptive foreground and monochrome mask share a centered 460 px-wide wallet, keeping the full mark inside Android's 66/108 safe circle. Android supplies the adaptive outline rather than baking a rounded tile into the foreground.

Normal adaptive icons use `#208AEF` in light mode and `#005EAD` in dark mode, via the `iconBackground` night resource in `with-brand-icons.cjs`. Android 13+ themed launchers tint the monochrome mask using the system wallpaper/theme; the in-app appearance preference does not override launcher theming. The 96 px notification small icon is white with transparent cutouts and background, letting Android provide light/dark contrast. The full-color large icon retains the brand blue. These resources require a new Android binary; Metro reloads do not update them.

## Financial cards and charts

The overview leads with a primary-container spending card and a segmented semicircle gauge: it answers how much of the spending limit has been used. Supporting outlined cards compare planned and recorded income and spending with a shared bar scale per comparison. Each spending category has its own outlined card in the monthly planner and overview. Planner cards group the category name, essential/flexible type, limit input, and edit action; overview cards retain exact limits, spending, and remaining amounts. Each expense estimate in the named-plan editor also has its own outlined card. Goal cards show saved versus target with the same comparison primitive. Named-plan cards show allocated funding and expense estimates; their values are explicitly estimates, independent of monthly actuals. The Plan tab opens named plans through a visible action; returning preserves the monthly draft. Chart marks use primary, outline, or error theme roles and have text equivalents. No chart motion, new artwork, or chart dependencies are needed. Native modal windows own keyboard avoidance so scrollable forms stay bounded above the keyboard.
