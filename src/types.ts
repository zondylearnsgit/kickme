export enum WeaponType {
  HAND = "HAND",
  BAT = "BAT",
  GUN = "GUN",
  ACID = "ACID",
}

export interface ThoughtBubbleState {
  id: number;
  text: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface GameState {
  health: number;
  isDead: boolean;
  selectedWeapon: WeaponType;
}

export const BODY_LABELS = {
  HEAD: "head",
  TORSO: "torso",
  ARM_UPPER: "arm_upper",
  ARM_LOWER: "arm_lower", // Fist
  LEG_INVISIBLE: "leg_invisible",
  FOOT: "foot",
  GROUND: "ground",
  WALL: "wall",
  BULLET: "bullet",
  ACID_DROP: "acid_drop",
};
