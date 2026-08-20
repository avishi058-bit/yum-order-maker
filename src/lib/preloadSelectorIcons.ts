// Preload all drink and side (fries/onion) selector icons at app startup so
// that by the time the user opens the drink or side picker the images are
// already in the browser cache and appear instantly.

// Sides / chips
import friesRegularImg from "@/assets/fries-regular.webp";
import waffleFriesImg from "@/assets/waffle-fries.webp";
import onionRingsSideImg from "@/assets/onion-rings.webp";
import tempuraOnionRingsImg from "@/assets/tempura-onion-rings.webp";

// Drinks
import drinkColaImg from "@/assets/drink-cola.png";
import drinkZeroImg from "@/assets/drink-zero.png";
import drinkSpriteImg from "@/assets/drink-sprite.png";
import drinkSpriteZeroImg from "@/assets/drink-sprite-zero.png";
import drinkFantaImg from "@/assets/drink-fanta.png";
import drinkFantaGrapeImg from "@/assets/drink-fanta-grape.png";
import drinkFantaExoticImg from "@/assets/drink-fanta-exotic.png";
import drinkSodaImg from "@/assets/drink-soda.png";
import drinkWaterImg from "@/assets/drink-water.png";
import drinkBluImg from "@/assets/drink-blu.png";
import drinkBluWatermelonImg from "@/assets/drink-blu-watermelon.png";
import drinkBluMojitoImg from "@/assets/drink-blu-mojito.png";
import drinkBluDayImg from "@/assets/drink-blu-day.png";
import drinkBluMelonAppleImg from "@/assets/drink-blu-melon-apple.png";
import drinkGoldstarImg from "@/assets/drink-goldstar.png";
import drinkUnfilteredImg from "@/assets/drink-unfiltered.webp";
import drinkStellaImg from "@/assets/drink-stella.png";
import drinkHeinekenImg from "@/assets/drink-heineken.png";
import drinkCoronaImg from "@/assets/drink-corona.png";
import drinkCarlsbergImg from "@/assets/drink-carlsberg.png";
import drinkPaulanerImg from "@/assets/drink-paulaner.png";
import drinkWeissImg from "@/assets/drink-weiss.png";
import drinkFlavoredWaterAppleImg from "@/assets/drink-flavored-water-apple.png";
import drinkFlavoredWaterGrapeImg from "@/assets/drink-flavored-water-grape.png";
import drinkGrapesImg from "@/assets/drink-grapes.png";
import drinkApplesImg from "@/assets/drink-apples.png";

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
