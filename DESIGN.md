---
version: alpha
name: OpenPath AI
description: A career opportunity workspace with the visual vocabulary of a night navigation chart.
colors:
  background: "#080B16"
  primary: "#8B5CF6"
  secondary: "#22D3EE"
  surface: "#111525"
  text: "#F4F2FD"
  muted: "#A6AAC0"
typography:
  display:
    fontFamily: "Space Grotesk Variable, sans-serif"
  sans:
    fontFamily: "Inter Variable, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  control: "0.625rem"
  panel: "1rem"
spacing:
  page-max: "76rem"
  section-gap: "6rem"
components:
  button: {}
  card: {}
  dialog: {}
---

# OpenPath AI design system

## Overview

An English-language landing page and workspace for students and early-career professionals. The visual reference is a night navigation chart. The hero gives each step a waypoint and a distinct position. In the workspace, dates, source text and the affected task receive more weight than decoration.

## Page hierarchy

- Landing → route map → partner and testimonial placeholders → problem → four-step workflow → clickable product preview → Application Studio → integrations → final CTA.
- Workspace → Dashboard, Discover → Opportunity detail, My Path, Application Studio, Agent activity, Profile, and Settings.
- Deadline review opens from the dashboard, notification center, My Path, agent activity, and the landing preview. The preview has its own session state.

## Colors

The core palette maps to the same-named variables in `src/styles.css` except text maps to `--ink`. CSS is the runtime owner. Violet signals the active route and main actions. Cyan marks sources and the endpoint. Amber and green use explicit warning and success labels. Light mode keeps the illustration on a fixed navy canvas and translates all reading surfaces.

## Typography

Space Grotesk gives headlines and wordmarks a compact, recognizable silhouette. Inter carries body copy, controls, and data. Monospace is reserved for waypoints, dates, and source annotations. The app uses English copy and explicit UTC deadline dates.

## Layout

The public shell centers a 76rem content area with a two-column hero and a full-width preview. The workspace pairs a collapsible sidebar with a flexible content column and contextual panels. Narrow layouts use a bottom navigation bar, full-width controls, and stacked content. The document owns scrolling.

## Elevation & Depth

Use hairline borders and small changes in surface tone for hierarchy. Concentrate glow inside the route chart. Place menus and dialogs above content without changing document layout.

## Shapes

Controls use a 10px radius, panels use a 16px radius, and category and status labels use pills. Lucide icons use the same stroke width and pair with text when meaning is contextual.

## Components

Buttons use solid, outline, and ghost emphasis. Shared card, search, badge, checklist, timeline, status and dialog primitives provide consistent states. A visible focus ring, explicit text labels and a platform-owned select popup support keyboard access. Short motion confirms state changes. Reduced motion removes ambient movement and displacement.

