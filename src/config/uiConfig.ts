/**
 * UI Layout & Animation Configuration
 * ====================================
 * Central config for positions, animations, and transitions of all floating/modal UI elements.
 * Change values here to adjust positions and animation behaviors across the entire app.
 */

// ─── Floating Button Positions ───────────────────────────────────────
// Values are Tailwind classes. Change to reposition floating elements.

export const uiPositions = {
  /** Accessibility widget floating button */
  accessibility: {
    button: "fixed top-24 left-4 z-[60]",
    panelSide: "left" as const, // "right" | "left" — which side the panel slides from
  },

  /** Shopping cart floating button */
  cartButton: {
    position: "fixed bottom-6 left-6 z-30",
  },

  /** Cookie consent banner */
  cookieBanner: {
    position: "fixed bottom-0 inset-x-0 z-[100] p-4",
  },

  /** Order tracking top bar */
  orderTopBar: {
    position: "sticky top-0 z-50",
  },
};

// ─── Drawer / Panel Animations ───────────────────────────────────────

export type SlideDirection = "left" | "right" | "top" | "bottom";

const slideAxis = (dir: SlideDirection) => {
  switch (dir) {
    case "left": return { prop: "x", from: "-100%", to: 0 };
    case "right": return { prop: "x", from: "100%", to: 0 };
    case "top": return { prop: "y", from: "-100%", to: 0 };
    case "bottom": return { prop: "y", from: "100%", to: 0 };
  }
};

export const getSlideAnimation = (direction: SlideDirection) => {
  const axis = slideAxis(direction);
  return {
    initial: { [axis.prop]: axis.from },
    animate: { [axis.prop]: axis.to },
    exit: { [axis.prop]: axis.from },
  };
};

export const drawerAnimations = {
  /** Cart drawer — slides from this direction */
  cart: {
    direction: "right" as SlideDirection,
    transition: { type: "spring" as const, damping: 25, stiffness: 300 },
  },

  /** Accessibility panel */
  accessibilityPanel: {
    direction: "right" as SlideDirection,
    transition: { type: "spring" as const, damping: 30, stiffness: 300 },
  },

  /** Checkout form */
  checkout: {
    direction: "bottom" as SlideDirection,
    transition: { type: "spring" as const, damping: 28, stiffness: 280 },
  },
};

// ─── Modal / Popup Animations ────────────────────────────────────────

export const modalAnimations = {
  /** Default modal (item customizer, sauce selector, etc.) */
  default: {
    overlay: {
      initial: { opacity: 0 },
      animate: { opacity: 0.5 },
      exit: { opacity: 0 },
    },
    content: {
      initial: { opacity: 0, scale: 0.92, y: 30 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.92, y: 30 },
      transition: { type: "spring" as const, damping: 25, stiffness: 300 },
    },
  },

  /** Item preview popup */
  preview: {
    overlay: {
      initial: { opacity: 0 },
      animate: { opacity: 0.6 },
      exit: { opacity: 0 },
    },
    content: {
      initial: { opacity: 0, scale: 0.85 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.85 },
      transition: { type: "spring" as const, damping: 22, stiffness: 260 },
    },
  },

  /** Dine-in selector (kiosk) */
  dineIn: {
    overlay: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    content: {
      initial: { scale: 0.8, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.8, opacity: 0 },
      transition: { type: "spring" as const, damping: 20, stiffness: 200 },
    },
  },
};

// ─── Hero Section Animations ─────────────────────────────────────────

export const heroAnimations = {
  logo: {
    initial: { opacity: 0, scale: 0.7 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.8, type: "spring" as const, stiffness: 200 },
  },
  title: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8 },
  },
  subtitle: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay: 0.15 },
  },
  description: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay: 0.3 },
  },
  cta: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.5, delay: 0.45 },
  },
};

// ─── Cookie Banner Animation ─────────────────────────────────────────

export const cookieBannerAnimation = {
  initial: { y: 100, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 100, opacity: 0 },
  transition: { type: "spring" as const, damping: 25, stiffness: 300 },
};

// ─── General Timing ──────────────────────────────────────────────────

export const timing = {
  /** Delay before showing cookie banner (ms) */
  cookieBannerDelay: 1500,
  /** Overlay click transition duration */
  overlayFadeDuration: 0.2,
};
