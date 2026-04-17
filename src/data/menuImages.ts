import classicImg from "@/assets/menu/classic.jpg";
import smashMoshavnikim from "@/assets/smash-moshavnikim.jpeg";
import smashDoubleCheese from "@/assets/menu/smash-double-cheese.jpg";
import doubleImg from "@/assets/menu/double.jpg";
import avishai from "@/assets/menu/avishai.jpg";
import crazySmash from "@/assets/menu/crazy-smash.jpg";
import specialHadegel from "@/assets/menu/special-hadegel.jpg";
import fries from "@/assets/menu/fries.jpg";
import waffleFries from "@/assets/menu/waffle-fries.jpeg";
import tempuraOnion from "@/assets/menu/tempura-onion.jpg";
import friendsMix from "@/assets/menu/friends-mix.jpg";
import canDrink from "@/assets/menu/coca-cola-can.webp";
import beerImg from "@/assets/menu/beer-goldstar.jpeg";
import bottleImg from "@/assets/menu/bottle-prigat.webp";
import beerPremiumImg from "@/assets/menu/beer-leffe.jpeg";
import beerWeissImg from "@/assets/menu/beer-weihenstephaner.webp";

export const menuImages: Record<string, string> = {
  classic: classicImg,
  "smash-moshavnikim": smashMoshavnikim,
  "smash-double-cheese": smashDoubleCheese,
  avishai: avishai,
  "crazy-smash": crazySmash,
  "special-hadegel": specialHadegel,
  fries: fries,
  "waffle-fries": waffleFries,
  "tempura-onion": tempuraOnion,
  "friends-mix": friendsMix,
  can: canDrink,
  bottle: bottleImg,
  "beer-regular": beerImg,
  "beer-premium": beerPremiumImg,
  "beer-weiss": beerWeissImg,
  double: doubleImg,
  // Meals - using burger images temporarily
  "meal-classic": classicImg,
  "meal-smash-moshavnikim": smashMoshavnikim,
  "meal-smash-double-cheese": smashDoubleCheese,
  "meal-avishai": avishai,
  "meal-crazy-smash": crazySmash,
  "meal-special-hadegel": specialHadegel,
  "meal-double": doubleImg,
};
