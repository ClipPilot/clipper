import { atom } from "jotai";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_affiliate: boolean;
}

export const userAtom = atom<User | null>(null);
