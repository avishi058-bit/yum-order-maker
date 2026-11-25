// Pictures shared by the burger sheet (ItemCustomizer) and the deal sheets,
// so both show the same doneness, ingredient, side and drink images.
import aioliImg from "@/assets/aioli-sauce.webp";
import picklesImg from "@/assets/pickles.webp";
import tomatoImg from "@/assets/tomato.webp";
import onionImg from "@/assets/onion.webp";
import mapleImg from "@/assets/maple.webp";
import onionRingsImg from "@/assets/onion-rings.webp";
import garlicConfitImg from "@/assets/garlic-confit.webp";
import friedOnionImg from "@/assets/fried-onion.webp";
import onionJamImg from "@/assets/onion-jam.webp";
import extraPattyImg from "@/assets/extra-patty.webp";
import cheddarIcon from "@/assets/menu/cheddar-icon.webp";
import donenessMediumImg from "@/assets/doneness-medium.webp";
import donenessMediumWellImg from "@/assets/doneness-medium-well.webp";
import donenessWellDoneImg from "@/assets/doneness-well-done.webp";
import friesRegularImg from "@/assets/fries-regular.webp";
import waffleFriesImg from "@/assets/waffle-fries.webp";
import onionRingsSideImg from "@/assets/onion-rings.webp";
import tempuraOnionRingsImg from "@/assets/tempura-onion-rings.webp";
import drinkColaImg from "@/assets/drink-cola.webp";
import drinkZeroImg from "@/assets/drink-zero.webp";
import drinkSpriteImg from "@/assets/drink-sprite.webp";
import drinkSpriteZeroImg from "@/assets/drink-sprite-zero.webp";
import drinkFantaImg from "@/assets/drink-fanta.webp";
import drinkFantaGrapeImg from "@/assets/drink-fanta-grape.webp";
import drinkFantaExoticImg from "@/assets/drink-fanta-exotic.webp";
import drinkFantaWildberryImg from "@/assets/drink-fanta-wildberry.webp";
import drinkSodaImg from "@/assets/drink-soda.webp";
import drinkWaterImg from "@/assets/drink-water.webp";
import drinkBluImg from "@/assets/drink-blu.webp";
import drinkBluWatermelonImg from "@/assets/drink-blu-watermelon.webp";
import drinkBluMojitoImg from "@/assets/drink-blu-mojito.webp";
import drinkBluDayImg from "@/assets/drink-blu-day.webp";
import drinkBluMelonAppleImg from "@/assets/drink-blu-melon-apple.webp";
import drinkGoldstarImg from "@/assets/drink-goldstar.webp";
import drinkStellaImg from "@/assets/drink-stella.webp";
import drinkHeinekenImg from "@/assets/drink-heineken.webp";
import drinkCoronaImg from "@/assets/drink-corona.webp";
import drinkCarlsbergImg from "@/assets/drink-carlsberg.webp";
import drinkPaulanerImg from "@/assets/drink-paulaner.webp";
import drinkWeissImg from "@/assets/drink-weiss.webp";
import drinkShapiraImg from "@/assets/drink-shapira.webp";
import drinkMaccabiImg from "@/assets/drink-maccabi.webp";
import drinkUnfilteredImg from "@/assets/drink-unfiltered.webp";
import drinkFlavoredWaterAppleImg from "@/assets/drink-flavored-water-apple.webp";
import drinkFlavoredWaterGrapeImg from "@/assets/drink-flavored-water-grape.webp";
import drinkGrapesImg from "@/assets/drink-grapes.webp";
import drinkOrangesImg from "@/assets/drink-apples.webp";
import fuzeTeaAsset from "@/assets/menu/fuze-tea.webp";
import friendsMixTrioImg from "@/assets/friends-mix-trio.webp";

export const mealSideImages: Record<string, string> = {
  "side-fries": friesRegularImg,
  "side-sweet-potato": waffleFriesImg,
  "side-onion-rings": onionRingsSideImg,
  "side-tempura": tempuraOnionRingsImg,
};

export const mealDrinkImages: Record<string, string> = {
  "drink-cola": drinkColaImg,
  "drink-zero": drinkZeroImg,
  "drink-sprite": drinkSpriteImg,
  "drink-sprite-zero": drinkSpriteZeroImg,
  "drink-fanta": drinkFantaImg,
  "drink-fanta-grape": drinkFantaGrapeImg,
  "drink-fanta-exotic": drinkFantaExoticImg,
  "drink-fanta-wildberry": drinkFantaWildberryImg,
  "drink-soda": drinkSodaImg,
  "drink-water": drinkWaterImg,
  "drink-blu": drinkBluImg,
  "drink-blu-watermelon": drinkBluWatermelonImg,
  "drink-blu-mojito": drinkBluMojitoImg,
  "drink-blu-day": drinkBluDayImg,
  "drink-blu-melon-apple": drinkBluMelonAppleImg,
  "drink-goldstar": drinkGoldstarImg,
  "drink-stella": drinkStellaImg,
  "drink-heineken": drinkHeinekenImg,
  "drink-corona": drinkCoronaImg,
  "drink-carlsberg": drinkCarlsbergImg,
  "drink-paulaner": drinkPaulanerImg,
  "drink-weiss": drinkWeissImg,
  "drink-shapira": drinkShapiraImg,
  "drink-maccabi": drinkMaccabiImg,
  "drink-unfiltered": drinkUnfilteredImg,
  "drink-flavored-water-apple": drinkFlavoredWaterAppleImg,
  "drink-flavored-water-grape": drinkFlavoredWaterGrapeImg,
  "drink-grapes": drinkGrapesImg,
  "drink-oranges": drinkOrangesImg,
  "drink-apples": drinkOrangesImg,
  "drink-fuze-tea": fuzeTeaAsset,
};

export const donenessImages: Record<string, string> = {
  "doneness-medium": donenessMediumImg,
  "doneness-medium-well": donenessMediumWellImg,
  "doneness-well-done": donenessWellDoneImg,
};

export const ingredientImages: Record<string, string> = {
  "aioli-sauce": aioliImg,
  "pickles": picklesImg,
  "tomato": tomatoImg,
  "onion": onionImg,
  "maple": mapleImg,
  "onion-rings": onionRingsImg,
  "garlic-confit": garlicConfitImg,
  "fried-onion": friedOnionImg,
  "onion-jam": onionJamImg,
  "extra-patty": extraPattyImg,
  "cheddar": cheddarIcon,
};
export { friendsMixTrioImg };
