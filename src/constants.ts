export const PHYSICS = {
  GROUP_BUDDY: -1, // Negative group for non-colliding parts of same group
  CATEGORY_BUDDY: 0x0002,
  CATEGORY_ENV: 0x0001,
  CATEGORY_BULLET: 0x0004,
  
  STIFFNESS: 0.15,
  DAMPING: 0.1,
  
  // Dimensions
  HEAD_RADIUS: 25,
  TORSO_RADIUS: 40,
  ARM_WIDTH: 15,
  ARM_HEIGHT: 35,
  FIST_RADIUS: 12,
  FOOT_RADIUS: 14,
  LEG_LENGTH: 60,
};

export const COLORS = {
  SKIN: '#f5cba7',
  SHIRT: '#3b82f6', // Tailwind blue-500
  SHOES: '#374151', // Dark gray
  TEXT: '#1f2937',
};

export const THOUGHTS = [
  "Ouch!",
  "Please Stop!",
  "Oh my god!!",
  "Why me?",
  "That hurts!",
  "Mercy!",
  "I'm just cardboard!",
];