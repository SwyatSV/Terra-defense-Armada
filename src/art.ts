export const spriteIds = [
  ["hero_prototype", "hero_twin", "hero_bastion", "hero_monolith"],
  ["enemy_standard", "enemy_scorpion", "enemy_cascade", "enemy_hammer"],
];
export const sprite = (faction: number, length: number) =>
  `/assets/sprites/${spriteIds[faction][length - 1]}.png`;
