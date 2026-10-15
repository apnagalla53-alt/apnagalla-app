# APNA GALLA LIGHT THEME IMPLEMENTATION

Local verification, 15 October 2026. The written approved design direction and existing repository references were used; no new reference image or Figma file was attached to these briefs. No new design system was introduced.

## DESIGN TOKENS

| Token | Light | Dark |
| --- | --- | --- |
| Page | #F8FBF7 | #101614 |
| Card | #FFFFFF | #1B2521 |
| Brand / readable action | #0A9B55 / #087744 | #79E5B3 |
| Text | #142019 | #F0F7F3 |
| Muted | #58675E | #B5C6BD |
| Info | #1754A0 / #EAF4FF | #ABCAFF / #243650 |
| Warning | #805000 / #FFF7DF | #FFCD88 / #43321C |
| Danger | #A82438 / #FFF0F1 | #FFB9C0 / #442830 |
| Special | #6B3AA1 / #F4EEFF | #D5B9FF / #352845 |

Shared token architecture: PASS. One component tree: PASS. Tokens bridge existing Retail variables; accounting and saved data do not branch by theme.

## HOME

New Shop Home, optional Getting Started, four action cards, zero-setup suggestion, Active Shop Home, today's actual summary, capped suggestions and Ask Apna Galla strip: PASS in implementation/local browser checks. The header uses a compact storefront icon, Apna Galla name and tagline. It does not add a duplicate Home title. No invented profit or growth figures are shown.

## ADD ITEM

Personalized recommendation, labelled category suggestion, recommended sell/buy unit chips, More Units, explicit pack conversion, collapsed Additional Details and Save CTA: PASS. Stock setup remains optional. Advanced options retain existing plan and item capability checks.

## ONBOARDING

Business Profile light/dark, Business Category sheet, search and selected state: PASS in local fixture UI checks. Pharmacy search narrowed the catalog to one result; choosing and reopening retained aria-pressed selection. Real Google/business onboarding HTTP behavior is separately covered by 14 backend tests. The browser category checks did not submit profile changes or use real Google accounts.

## ASK APNA GALLA

Chat, structured summary, server-provided reason ranking, follow-up chips and authoritative data only: PASS. Missing comparison history remains explicit. The language segment control fits mobile width. Suggestions and the assistant share facts rather than inventing causes.

## MOBILE / THEMES / BUILD

Small Android-sized 360 px and large 430 px viewports; light and dark; 100% and 200% root text; Home, Add Item, intake choices and voice entry: 32/32 cases passed scoped WCAG 2 A/AA automated checks, horizontal bounds and visible control bounds. Enlarged navigation uses five equal columns and wrapping labels. Native virtual-keyboard behavior is not emulated by a desktop browser; actual keyboard/device confirmation remains pending. Scripted checks confirmed payment does not autofocus an input and sheets preserve their parent.

Light: PASS. Dark: PASS. Same component architecture: PASS. Frontend build and TypeScript: PASS. Category-sheet light/dark checks and screenshots were also inspected; the dark header's inherited text color was corrected.

Local screenshots are under `output/playwright/` (ignored generated evidence). Detailed result counts, browser workflow evidence and limitations are in [combined verification](verification/APNA_GALLA_EXPERIENCE_20261015.md). No field-tested or pixel-identical-to-an-unattached-reference claim is made.
