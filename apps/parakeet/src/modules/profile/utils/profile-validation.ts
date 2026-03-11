const BIRTH_YEAR_REGEX = /^\d{4}$/;

export function isValidBirthYear(year: string): boolean {
  return BIRTH_YEAR_REGEX.test(year);
}

export function isValidBodyweight(kg: string): boolean {
  return parseFloat(kg) > 0;
}
