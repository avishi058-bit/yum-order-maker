// Preload all drink and side (fries/onion) selector icons at app startup so
// that by the time the user opens the drink or side picker the images are
// already in the browser cache and appear instantly.

// Sides / chips
import friesRegularImg from "@/assets/fries-regular.webp";
import waffleFriesImg from "@/assets/waffle-fries.webp";
import onionRingsSideImg from "@/assets/onion-rings.webp";
import tempuraOnionRingsImg from "@/assets/tempura-onion-rings.webp";

// Drinks
import drinkColaImg from "@/assets/drink-cola.webp";
import drinkZeroImg from "@/assets/drink-zero.webp";
import drinkSpriteImg from "@/assets/drink-sprite.webp";
import drinkSpriteZeroImg from "@/assets/drink-sprite-zero.webp";
import drinkFantaImg from "@/assets/drink-fanta.webp";
import drinkFantaGrapeImg from "@/assets/drink-fanta-grape.webp";
import drinkFantaExoticImg from "@/assets/drink-fanta-exotic.webp";
import drinkSodaImg from "@/assets/drink-soda.webp";
import drinkWaterImg from "@/assets/drink-water.webp";
import drinkBluImg from "@/assets/drink-blu.webp";
import drinkBluWatermelonImg from "@/assets/drink-blu-watermelon.webp";
import drinkBluMojitoImg from "@/assets/drink-blu-mojito.webp";
import drinkBluDayImg from "@/assets/drink-blu-day.webp";
import drinkBluMelonAppleImg from "@/assets/drink-blu-melon-apple.webp";
import drinkGoldstarImg from "@/assets/drink-goldstar.webp";
import drinkUnfilteredImg from "@/assets/drink-unfiltered.webp";
import drinkStellaImg from "@/assets/drink-stella.webp";
import drinkHeinekenImg from "@/assets/drink-heineken.webp";
import drinkCoronaImg from "@/assets/drink-corona.webp";
import drinkCarlsbergImg from "@/assets/drink-carlsberg.webp";
import drinkPaulanerImg from "@/assets/drink-paulaner.webp";
import drinkWeissImg from "@/assets/drink-weiss.webp";
import drinkFlavoredWaterAppleImg from "@/assets/drink-flavored-water-apple.webp";
import drinkFlavoredWaterGrapeImg from "@/assets/drink-flavored-water-grape.webp";
import drinkGrapesImg from "@/assets/drink-grapes.webp";
import drinkApplesImg from "@/assets/drink-apples.webp";

const SELECTOR_ICONS: string[] = [
  friesRegularImg,
  waffleFriesImg,
  onionRingsSideImg,
  tempuraOnionRingsImg,
  drinkColaImg,
  drinkZeroImg,
  drinkSpriteImg,
  drinkSpriteZeroImg,
  drinkFantaImg,
  drinkFantaGrapeImg,
  drinkFantaExoticImg,
  drinkSodaImg,
  drinkWaterImg,
  drinkBluImg,
  drinkBluWatermelonImg,
  drinkBluMojitoImg,
  drinkBluDayImg,
  drinkBluMelonAppleImg,
  drinkGoldstarImg,
  drinkUnfilteredImg,
  drinkStellaImg,
  drinkHeinekenImg,
  drinkCoronaImg,
  drinkCarlsbergImg,
  drinkPaulanerImg,
  drinkWeissImg,
  drinkFlavoredWaterAppleImg,
  drinkFlavoredWaterGrapeImg,
  drinkGrapesImg,
  drinkApplesImg,
];

export function preloadSelectorIcons() {
  if (typeof window === "undefined") return;
  const kick = () => {
    SELECTOR_ICONS.forEach((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    });
  };
  // Defer to idle so it doesn't compete with the initial render / LCP.
  const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(kick);
  } else {
    setTimeout(kick, 300);
  }
}
