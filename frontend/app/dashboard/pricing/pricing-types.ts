import type { ButtonProps } from "@heroui/react";

export enum TiersEnum {
  Free = "free",
  Studio = "studio",
  Scale = "scale",
  Enterprise = "enterprise",
}

export type Tier = {
  key: TiersEnum;
  title: string;
  price: string;
  priceSuffix?: string;
  billedAmount?: string;
  href: string;
  description?: string;
  mostPopular?: boolean;
  featured?: boolean;
  features?: string[];
  buttonText: string;
  buttonColor?: ButtonProps["color"];
  buttonVariant: ButtonProps["variant"];
  generations?: string;
  credits?: string;
  priceId?: string;
  addonPriceId?: string;
};
