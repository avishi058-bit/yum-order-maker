import classicImg from "@/assets/menu/classic.webp";
import smashMoshavnikim from "@/assets/smash-moshavnikim.webp";
import smashDoubleCheese from "@/assets/menu/smash-double-cheese.webp";
import doubleImg from "@/assets/menu/double.webp";
import avishai from "@/assets/menu/avishai.webp";
import crazySmash from "@/assets/menu/crazy-smash.webp";
import specialHadegel from "@/assets/menu/special-hadegel.webp";
import fries from "@/assets/menu/fries.webp";
import waffleFriesAsset from "@/assets/menu/waffle-fries.jpeg.asset.json";
import tempuraOnion from "@/assets/menu/tempura-onion.webp";
import friendsMixAsset from "@/assets/menu/friends-mix.jpeg.asset.json";
import canDrink from "@/assets/menu/coca-cola-can.webp";
import beerImg from "@/assets/menu/beer-goldstar.webp";
import bottleImg from "@/assets/menu/bottle-prigat.webp";
import beerPremiumImg from "@/assets/menu/beer-leffe.webp";
import beerWeissImg from "@/assets/menu/beer-weihenstephaner.webp";
import hafMifsha from "@/assets/menu/haf-mifsha.webp";
import napoleon from "@/assets/menu/napoleon.jpg";
import waterAsset from "@/assets/menu/water-bottle.webp.asset.json";
import sodaTempoAsset from "@/assets/menu/soda-tempo.webp.asset.json";
import flavoredWaterAsset from "@/assets/menu/flavored-water-grape.png.asset.json";
import arayesSpecialAsset from "@/assets/menu/arayes-special.jpeg.asset.json";
import arayesSpecial4Asset from "@/assets/menu/arayes-special-4.jpeg.asset.json";



export const menuImages: Record<string, string> = {
  classic: classicImg,
  "smash-moshavnikim": smashMoshavnikim,
  "smash-double-cheese": smashDoubleCheese,
  avishai: avishai,
  "crazy-smash": crazySmash,
  "special-hadegel": specialHadegel,
  fries: fries,
  "sweet-potato-fries": waffleFriesAsset.url,
  "tempura-onion": tempuraOnion,
  "friends-mix": friendsMixAsset.url,
  "arayes-special": arayesSpecialAsset.url,
  "arayes-special-4": arayesSpecial4Asset.url,
  can: canDrink,
  bottle: bottleImg,
  water: waterAsset.url,
  "flavored-water": flavoredWaterAsset.url,
  soda: sodaTempoAsset.url,


  "beer-regular": beerImg,
  "beer-premium": beerPremiumImg,
  "beer-weiss": beerWeissImg,
  double: doubleImg,
  "haf-mifsha": hafMifsha,
  napoleon: napoleon,
  // Meals - using burger images temporarily
  "meal-classic": classicImg,
  "meal-smash-moshavnikim": smashMoshavnikim,
  "meal-smash-double-cheese": smashDoubleCheese,
  "meal-avishai": avishai,
  "meal-crazy-smash": crazySmash,
  "meal-special-hadegel": specialHadegel,
  "meal-double": doubleImg,
  "meal-haf-mifsha": hafMifsha,
  "meal-napoleon": napoleon,
};
