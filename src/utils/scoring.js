export const WEIGHTS = {
  health: 0.6,
  expiry: 0.4,
};

export function days_until_expiry(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = expiryDate.split("-").map(Number);
  const expiry = new Date(year, month - 1, day);

  return Math.round((expiry - today) / (1000 * 60 * 60 * 24));
}

export function calculate_health_rating(sugar, carbs, fat, protein) {
  const sugarScore = Math.max(0, 100 - sugar * 4);
  const carbsScore = Math.max(0, 100 - carbs * 2);
  const fatScore = Math.max(0, 100 - fat * 2);
  const proteinScore = Math.max(0, 100 - protein * 2);

  const healthScore =
    sugarScore * 0.4 +
    fatScore * 0.25 +
    carbsScore * 0.15 +
    proteinScore * 0.2;

  const healthRating = Number((healthScore / 10).toFixed(1));

  return { healthScore, healthRating };
}

export function calculate_expiry_score(expiryDate) {
  const daysLeft = days_until_expiry(expiryDate);

  if (daysLeft <= 0) return 100;
  if (daysLeft <= 1) return 90;
  if (daysLeft <= 3) return 75;
  if (daysLeft <= 7) return 50;
  if (daysLeft <= 14) return 25;
  if (daysLeft <= 30) return 10;

  return 5;
}

export function get_expiry_status(expiryDate) {
  const daysLeft = days_until_expiry(expiryDate);

  if (daysLeft < 0) return "Kedaluwarsa";
  if (daysLeft === 0) return "Kedaluwarsa hari ini";
  if (daysLeft <= 3) return "Segera";
  if (daysLeft <= 7) return "Segera kadaluwarsa";

  return "Aman";
}

export function get_priority_label(priority, expiryDate) {
  const expired = get_expiry_status(expiryDate) === "Kedaluwarsa" ? 1 : 0;

  if (expired) return "Segera buang";

  if (priority >= 80) return "Gunakan dulu";
  if (priority >= 60) return "Gunakan segera";
  if (priority >= 40) return "Normal";
  return "Prioritas rendah";
}

export function calculate_priority(item) {
  const { healthScore } = calculate_health_rating(
    item.sugar,
    item.carbs,
    item.fat,
    item.protein
  );

  const expiryScore = calculate_expiry_score(item.expiry);
  const priority = healthScore * WEIGHTS.health + expiryScore * WEIGHTS.expiry;

  return {
    priority: Math.round(priority),
    health: Number(healthScore.toFixed(1)),
    expiry: Number(expiryScore.toFixed(1)),
  };
}

export function sortInventory(items) {
  return [...items]
    .map((item) => ({
      ...item,
      scoring: calculate_priority(item),
    }))
    .sort((first, second) => {
      const firstExpired = get_expiry_status(first.expiry) === "Expired" ? 1 : 0;
      const secondExpired = get_expiry_status(second.expiry) === "Expired" ? 1 : 0;

      if (firstExpired !== secondExpired) {
        return secondExpired - firstExpired;
      }

      return second.scoring.priority - first.scoring.priority;
    });
}

export function getExpiryAlert(expiryStatus, itemName) {
  if (expiryStatus === "Kedaluwarsa") {
    return `${itemName} sudah kedaluwarsa. Jangan dikonsumsi tanpa mengecek keamanannya.`;
  }

  if (expiryStatus === "Kedaluwarsa hari ini") {
    return `${itemName} kedaluwarsa hari ini — konsumsi atau gunakan hari ini jika aman.`;
  }

  if (expiryStatus === "Segera") {
    return `${itemName} akan segera kedaluwarsa — konsumsi sesegera mungkin.`;
  }

  return null;
}
