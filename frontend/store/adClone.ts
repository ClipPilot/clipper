"use client";

import { atom } from "jotai";

export interface AdCloneVideo {
  file: File;
  preview: string;
  duration: number;
}

export interface AdCloneProduct {
  file: File;
  preview: string;
}

export interface AdCloneState {
  video: AdCloneVideo | null;
  productImage: AdCloneProduct | null;
  productName: string;
  productDescription: string;
  adDirection: string;
}

export const adCloneVideoAtom = atom<AdCloneVideo | null>(null);
export const adCloneProductImageAtom = atom<AdCloneProduct | null>(null);
export const adCloneProductNameAtom = atom("");
export const adCloneProductDescriptionAtom = atom("");
export const adCloneAdDirectionAtom = atom("");

export const adCloneCanProceedAtom = atom((get) => {
  const video = get(adCloneVideoAtom);
  const productImage = get(adCloneProductImageAtom);
  const productName = get(adCloneProductNameAtom);
  const productDescription = get(adCloneProductDescriptionAtom);

  return !!(
    video &&
    productImage &&
    productName.trim() &&
    productDescription.trim()
  );
});

export const resetAdCloneAtom = atom(null, (get, set) => {
  const video = get(adCloneVideoAtom);
  const productImage = get(adCloneProductImageAtom);

  if (video?.preview) URL.revokeObjectURL(video.preview);
  if (productImage?.preview) URL.revokeObjectURL(productImage.preview);

  set(adCloneVideoAtom, null);
  set(adCloneProductImageAtom, null);
  set(adCloneProductNameAtom, "");
  set(adCloneProductDescriptionAtom, "");
  set(adCloneAdDirectionAtom, "");
});
