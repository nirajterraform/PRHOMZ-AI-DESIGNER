// Signup profile option sets and the searchable country list.
// Shared shape between the Auth form (client) and handleOnSignup (server-side
// validation). Keep the string values here as the single source of truth — the
// backend validates submitted values against these exact sets.

export const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-binary",
  "Prefer not to say",
] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

export const AGE_RANGE_OPTIONS = [
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const;
export type AgeRange = (typeof AGE_RANGE_OPTIONS)[number];

// ISO 3166 country names. Kept as plain display strings — analytics groups on
// the exact value, so the dropdown is the only way to set it (no free text).
export const COUNTRIES: string[] = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas",
  "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin",
  "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei",
  "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon",
  "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia",
  "Comoros", "Congo (Brazzaville)", "Congo (Kinshasa)", "Costa Rica", "Croatia",
  "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica",
  "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea",
  "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada",
  "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras",
  "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan",
  "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia",
  "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
  "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique",
  "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand",
  "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea",
  "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
  "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles",
  "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka",
  "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
  "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago",
  "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
  "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen",
  "Zambia", "Zimbabwe",
];

// --- Shared validation helpers (used by both client and server) ---

export interface SignupProfile {
  username: string;
  gender: string;
  ageRange: string;
  zipCode: string;
  country: string;
}

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
const ZIP_REGEX = /^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/;

/**
 * Validate a submitted profile. Returns a human-readable error string for the
 * first invalid field, or null if everything is valid. Shared verbatim by the
 * Auth form and handleOnSignup so client and server agree.
 */
export function validateSignupProfile(p: Partial<SignupProfile> | undefined): string | null {
  if (!p) return "Profile details are required.";

  const username = (p.username ?? "").trim();
  if (!USERNAME_REGEX.test(username)) {
    return "Username must be 3-20 characters: letters, numbers, or underscore.";
  }
  if (!GENDER_OPTIONS.includes(p.gender as Gender)) {
    return "Please select a gender.";
  }
  if (!AGE_RANGE_OPTIONS.includes(p.ageRange as AgeRange)) {
    return "Please select an age range.";
  }
  const zip = (p.zipCode ?? "").trim();
  if (!ZIP_REGEX.test(zip)) {
    return "Please enter a valid zip / postal code.";
  }
  if (!COUNTRIES.includes((p.country ?? "").trim())) {
    return "Please select a country.";
  }
  return null;
}
