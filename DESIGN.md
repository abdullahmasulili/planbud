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

## Financial cards and charts

The overview leads with a primary-container spending card and a segmented semicircle gauge: it answers how much of the spending limit has been used. Supporting outlined cards compare planned and recorded income and spending with a shared bar scale per comparison. Each spending category has its own outlined card in the monthly planner and overview. Planner cards group the category name, essential/flexible type, limit input, and edit action; overview cards retain exact limits, spending, and remaining amounts. Each expense estimate in the named-plan editor also has its own outlined card. Goal cards show saved versus target with the same comparison primitive. Named-plan cards show allocated funding and expense estimates; their values are explicitly estimates, independent of monthly actuals. The Plan tab opens named plans through a visible action; returning preserves the monthly draft. Chart marks use primary, outline, or error theme roles and have text equivalents. No chart motion, new artwork, or chart dependencies are needed. Native modal windows own keyboard avoidance so scrollable forms stay bounded above the keyboard.
