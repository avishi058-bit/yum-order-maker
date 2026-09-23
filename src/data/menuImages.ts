import classicImg from "@/assets/menu/classic.webp";
import smashMoshavnikim from "@/assets/smash-moshavnikim.webp";
import smashDoubleCheeseAsset from "@/assets/menu-originals/smash-double-cheese-original.jpeg.asset.json";
import doubleImg from "@/assets/menu/double.webp";
import avishaiAsset from "@/assets/menu-originals/avishai-original.jpeg.asset.json";
import crazySmashAsset from "@/assets/menu/crazy-smash-opt.webp";
import specialHadegelAsset from "@/assets/menu-originals/special-hadegel-original.jpeg.asset.json";
import fries from "@/assets/menu/fries.webp";
import waffleFriesAsset from "@/assets/menu/waffle-fries-opt.webp";
import tempuraOnionAsset from "@/assets/menu-originals/tempura-onion-original.jpeg.asset.json";
import friendsMixAsset from "@/assets/menu/friends-mix-opt.webp";
import canDrink from "@/assets/menu/coca-cola-can.webp";
import beerImg from "@/assets/menu/beer-goldstar.webp";
import bottleImg from "@/assets/menu/bottle-prigat.webp";
import beerPremiumImg from "@/assets/menu/beer-leffe.webp";
import beerWeissImg from "@/assets/menu/beer-weihenstephaner.webp";
import beerShapiraImg from "@/assets/menu/beer-shapira.webp";
import beerMaccabiImg from "@/assets/menu/beer-maccabi.webp";
import hafMifsha from "@/assets/menu/haf-mifsha.webp";
import crispyChickenAsset from "@/assets/menu-originals/crispy-chicken-original.jpeg.asset.json";
import waterAsset from "@/assets/menu/water-bottle-opt.webp";
import sodaTempoAsset from "@/assets/menu/soda-tempo-opt.webp";
import flavoredWaterAsset from "@/assets/menu/flavored-water-grape-opt.webp";
import arayesSpecialAsset from "@/assets/menu/arayes-special-opt.webp";
import arayesSpecial4Asset from "@/assets/menu/arayes-special-4-opt.webp";
import fuzeTeaAsset from "@/assets/menu/fuze-tea.webp";



export const menuImages: Record<string, string> = {
  classic: classicImg,
  "smash-moshavnikim": smashMoshavnikim,
  "smash-double-cheese": smashDoubleCheeseAsset.url,
  avishai: avishaiAsset.url,
  "crazy-smash": crazySmashAsset,

  "special-hadegel": specialHadegelAsset.url,
  fries: fries,
  "sweet-potato-fries": waffleFriesAsset,
  "tempura-onion": tempuraOnionAsset.url,
  "friends-mix": friendsMixAsset,
  "arayes-special": arayesSpecialAsset,
  "arayes-special-4": arayesSpecial4Asset,
  can: canDrink,
  bottle: bottleImg,
  water: waterAsset,
  "flavored-water": flavoredWaterAsset,
  soda: sodaTempoAsset,


  "beer-regular": beerImg,
  "beer-premium": beerPremiumImg,
  "beer-weiss": beerWeissImg,
  "beer-shapira": beerShapiraImg,
  "beer-maccabi": beerMaccabiImg,
  "fuze-tea": fuzeTeaAsset,
  double: doubleImg,
  "haf-mifsha": hafMifsha,
  "crispy-chicken": crispyChickenAsset.url,
  // Meals - using burger images temporarily
  "meal-classic": classicImg,
  "meal-smash-moshavnikim": smashMoshavnikim,
  "meal-smash-double-cheese": smashDoubleCheeseAsset.url,
  "meal-avishai": avishaiAsset.url,
  "meal-crazy-smash": crazySmashAsset,

  "meal-special-hadegel": specialHadegelAsset.url,
  "meal-double": doubleImg,
  "meal-haf-mifsha": hafMifsha,
  "meal-crispy-chicken": crispyChickenAsset.url,
};
