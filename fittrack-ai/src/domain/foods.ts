/**
 * Common Indian foods with typical servings, for one-tap manual entry. Values are
 * typical estimates per serving, not measurements. Users can add their own foods;
 * this list is also seeded into the `food_items` table (see the seed migration).
 */
export interface Food { name: string; serving: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; fibre_g: number; junk?: boolean }

export const FOODS: readonly Food[] = [
  { name: 'Poha', serving: '1 plate', kcal: 270, protein_g: 5, carbs_g: 45, fat_g: 8, fibre_g: 3 },
  { name: 'Idli', serving: '2 pieces', kcal: 120, protein_g: 4, carbs_g: 24, fat_g: 0.5, fibre_g: 1.5 },
  { name: 'Idli with sambar', serving: '2 idli + 1 bowl', kcal: 250, protein_g: 9, carbs_g: 44, fat_g: 4, fibre_g: 5 },
  { name: 'Plain dosa', serving: '1 dosa', kcal: 170, protein_g: 4, carbs_g: 28, fat_g: 5, fibre_g: 1.5 },
  { name: 'Masala dosa', serving: '1 dosa', kcal: 390, protein_g: 7, carbs_g: 55, fat_g: 15, fibre_g: 4 },
  { name: 'Upma', serving: '1 bowl', kcal: 250, protein_g: 6, carbs_g: 38, fat_g: 8, fibre_g: 3 },
  { name: 'Omelette', serving: '2 eggs', kcal: 190, protein_g: 13, carbs_g: 1, fat_g: 15, fibre_g: 0 },
  { name: 'Boiled eggs', serving: '2 eggs', kcal: 150, protein_g: 12.5, carbs_g: 1, fat_g: 10.5, fibre_g: 0 },
  { name: 'Egg bhurji', serving: '2 eggs', kcal: 220, protein_g: 13, carbs_g: 4, fat_g: 17, fibre_g: 1 },
  { name: 'Chai, full sugar', serving: '1 cup', kcal: 90, protein_g: 2, carbs_g: 14, fat_g: 2.5, fibre_g: 0 },
  { name: 'Chai, no sugar', serving: '1 cup', kcal: 50, protein_g: 2, carbs_g: 4, fat_g: 2.5, fibre_g: 0 },
  { name: 'Coffee with milk', serving: '1 cup', kcal: 80, protein_g: 2.5, carbs_g: 11, fat_g: 3, fibre_g: 0 },
  { name: 'Black coffee', serving: '1 cup', kcal: 5, protein_g: 0.3, carbs_g: 0, fat_g: 0, fibre_g: 0 },
  { name: 'Steamed rice', serving: '1 bowl (150 g)', kcal: 195, protein_g: 4, carbs_g: 43, fat_g: 0.4, fibre_g: 0.6 },
  { name: 'Roti', serving: '1 roti', kcal: 100, protein_g: 3, carbs_g: 18, fat_g: 2, fibre_g: 2.5 },
  { name: 'Roti', serving: '2 roti', kcal: 200, protein_g: 6, carbs_g: 36, fat_g: 4, fibre_g: 5 },
  { name: 'Paratha', serving: '1 paratha', kcal: 220, protein_g: 4.5, carbs_g: 30, fat_g: 9, fibre_g: 3 },
  { name: 'Dal', serving: '1 bowl', kcal: 180, protein_g: 10, carbs_g: 24, fat_g: 5, fibre_g: 6 },
  { name: 'Rajma', serving: '1 bowl', kcal: 230, protein_g: 12, carbs_g: 32, fat_g: 6, fibre_g: 9 },
  { name: 'Chole', serving: '1 bowl', kcal: 260, protein_g: 11, carbs_g: 34, fat_g: 9, fibre_g: 9 },
  { name: 'Mixed vegetable sabzi', serving: '1 bowl', kcal: 150, protein_g: 4, carbs_g: 14, fat_g: 9, fibre_g: 5 },
  { name: 'Paneer bhurji', serving: '1 bowl', kcal: 300, protein_g: 17, carbs_g: 8, fat_g: 22, fibre_g: 1.5 },
  { name: 'Paneer butter masala', serving: '1 bowl', kcal: 400, protein_g: 14, carbs_g: 14, fat_g: 32, fibre_g: 2 },
  { name: 'Palak paneer', serving: '1 bowl', kcal: 300, protein_g: 14, carbs_g: 10, fat_g: 23, fibre_g: 4 },
  { name: 'Chicken curry', serving: '1 bowl', kcal: 300, protein_g: 26, carbs_g: 8, fat_g: 18, fibre_g: 2 },
  { name: 'Grilled chicken', serving: '150 g', kcal: 250, protein_g: 40, carbs_g: 1, fat_g: 9, fibre_g: 0 },
  { name: 'Tandoori chicken', serving: '2 pieces', kcal: 260, protein_g: 36, carbs_g: 4, fat_g: 11, fibre_g: 0.5 },
  { name: 'Fish curry', serving: '1 bowl', kcal: 250, protein_g: 24, carbs_g: 6, fat_g: 14, fibre_g: 1.5 },
  { name: 'Fish fry', serving: '2 pieces', kcal: 300, protein_g: 24, carbs_g: 10, fat_g: 18, fibre_g: 0.5, junk: true },
  { name: 'Chicken biryani', serving: '1 plate', kcal: 600, protein_g: 28, carbs_g: 70, fat_g: 22, fibre_g: 3 },
  { name: 'Veg biryani', serving: '1 plate', kcal: 480, protein_g: 10, carbs_g: 72, fat_g: 16, fibre_g: 5 },
  { name: 'Khichdi', serving: '1 bowl', kcal: 280, protein_g: 10, carbs_g: 44, fat_g: 7, fibre_g: 5 },
  { name: 'Egg fried rice', serving: '1 plate', kcal: 480, protein_g: 14, carbs_g: 66, fat_g: 17, fibre_g: 3 },
  { name: 'Veg fried rice', serving: '1 plate', kcal: 420, protein_g: 8, carbs_g: 68, fat_g: 13, fibre_g: 4 },
  { name: 'Veg sandwich', serving: '1 sandwich', kcal: 250, protein_g: 8, carbs_g: 36, fat_g: 8, fibre_g: 4 },
  { name: 'Chicken sandwich', serving: '1 sandwich', kcal: 330, protein_g: 22, carbs_g: 34, fat_g: 11, fibre_g: 3 },
  { name: 'Curd', serving: '1 bowl (150 g)', kcal: 95, protein_g: 5, carbs_g: 7, fat_g: 5, fibre_g: 0 },
  { name: 'Buttermilk', serving: '1 glass', kcal: 45, protein_g: 2.5, carbs_g: 4, fat_g: 1.5, fibre_g: 0 },
  { name: 'Banana', serving: '1 medium', kcal: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fibre_g: 3 },
  { name: 'Apple', serving: '1 medium', kcal: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, fibre_g: 4.5 },
  { name: 'Mixed fruit', serving: '1 bowl', kcal: 110, protein_g: 1.5, carbs_g: 27, fat_g: 0.5, fibre_g: 4 },
  { name: 'Almonds', serving: '10 nuts', kcal: 70, protein_g: 2.5, carbs_g: 2.5, fat_g: 6, fibre_g: 1.5 },
  { name: 'Peanuts', serving: 'handful (30 g)', kcal: 170, protein_g: 7.5, carbs_g: 5, fat_g: 14.5, fibre_g: 2.5 },
  { name: 'Sprouts salad', serving: '1 bowl', kcal: 150, protein_g: 10, carbs_g: 24, fat_g: 1.5, fibre_g: 7 },
  { name: 'Green salad', serving: '1 large bowl', kcal: 60, protein_g: 2.5, carbs_g: 11, fat_g: 0.5, fibre_g: 4 },
  { name: 'Whey scoop', serving: '1 scoop', kcal: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, fibre_g: 0 },
  { name: 'Samosa', serving: '1 piece', kcal: 260, protein_g: 4, carbs_g: 30, fat_g: 14, fibre_g: 2.5, junk: true },
  { name: 'Vada pav', serving: '1 piece', kcal: 300, protein_g: 6, carbs_g: 42, fat_g: 12, fibre_g: 3, junk: true },
  { name: 'Pizza', serving: '2 slices', kcal: 560, protein_g: 22, carbs_g: 66, fat_g: 22, fibre_g: 4, junk: true },
  { name: 'Burger', serving: '1 burger', kcal: 500, protein_g: 20, carbs_g: 48, fat_g: 25, fibre_g: 3, junk: true },
  { name: 'Gulab jamun', serving: '2 pieces', kcal: 300, protein_g: 4, carbs_g: 46, fat_g: 11, fibre_g: 0.5, junk: true },
];

/** Case-insensitive search: names starting with the query first, then names containing it. */
export function searchFoods<T extends { name: string }>(foods: readonly T[], query: string, limit = 6): T[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = foods.filter((f) => f.name.toLowerCase().startsWith(q));
  const contains = foods.filter((f) => !f.name.toLowerCase().startsWith(q) && f.name.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}
