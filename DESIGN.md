---
version: alpha
name: CareSlot
description: Bilingual clinic reservation interface with the approved cream, navy, and teal visual system.
colors:
  cream: "#f6f1e7"
  white: "#ffffff"
  navy: "#0b2a3c"
  teal: "#0d8f8d"
  teal-dark: "#087370"
  muted: "#5b7083"
  border: "#dce9ec"
  soft: "#e0f3f1"
  error: "#b42318"
  warning: "#95600c"
  success: "#067647"
typography:
  english:
    fontFamily: Inter
  arabic:
    fontFamily: Cairo
rounded:
  base: 12px
---

## Overview

CareSlot lets patients select a specialty, choose an appointment, and verify a booking request. Preserve the approved clinic photography and cream, navy, and teal visual direction in both languages.

## Colors

Use teal for booking actions, navy for primary text, and soft teal for appointment summaries. Warning and error colors indicate appointment states and recovery.

## Typography

Use the locally hosted English and Arabic font families and preserve the approved heading scale. Allow patient and doctor names to wrap so identifying information stays readable.

## Layout

The consultation photograph is the main visual. Align text and actions to the reading edge; mirror the order for Arabic. Stack the photograph beneath mobile booking actions.

```text
Desktop: [headline + explanation] [consultation photograph]
         [Book] [How it works]
         Already booked? Find my booking

Mobile:  headline
         explanation
         [Book a visit]
         Already booked? Find my booking
         consultation photograph
```

## Components

Preserve the approved palette, fonts, photographs, and returning-patient text link. Spend visual emphasis on the clinic photograph and primary booking action.

Keep numbered markers in the three-step booking process, where sequence matters. Remove them from specialties: a specialty is a choice, not step four or five. Give each specialty card an explicit “View appointments” action and matching hover/focus feedback.

Retain the restored portrait-based doctors section. Place the booking assistant below the visit summary. Keep booking steps navigable while preserving entered details and validating date and time selections.

Use shared button variants with visible keyboard focus and pointer-aware hover feedback. Keep destructive feedback red and preserve reduced-motion behavior.

## Do's and Don'ts

Consolidate component mobile overrides in the existing responsive layers. Avoid conflicting CSS and unnecessary important declarations. Retain the deliberate reduced-motion and hidden-state accessibility overrides.
