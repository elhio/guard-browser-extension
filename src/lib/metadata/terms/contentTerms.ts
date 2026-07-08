/**
 * Terms that indicate violent content, for scanning descriptive metadata fields
 * (IPTC keywords/caption, XMP subject/description, EXIF description/comment).
 *
 * Note: these are matched with lenient, case-insensitive substring matching (the same
 * as the AI term lists), so entries are deliberately specific / multi-word to limit
 * false positives — short ambiguous stems like `gore`/`gory` (matches "category") are
 * intentionally omitted.
 */
export const VIOLENCE_TERMS: readonly string[] = [
  'graphic violence',
  'extreme violence',
  'violent content',
  'bloodshed',
  'gruesome',
  'mutilation',
  'mutilated',
  'dismemberment',
  'decapitation',
  'beheading',
  'massacre',
  'war crime',
  'torture',
  'brutal killing',
  'dead body',
  'corpse',
  'gunshot wound',
];

/**
 * Terms that indicate sexually explicit content, for scanning descriptive metadata
 * fields plus common adult / content-rating markers. Same substring-matching caveat
 * as {@link VIOLENCE_TERMS} — bare stems like `nude`/`sex` are omitted on purpose.
 */
export const EXPLICIT_TERMS: readonly string[] = [
  'nsfw',
  'not safe for work',
  'sexually explicit',
  'explicit content',
  'explicit material',
  'pornographic',
  'pornography',
  'hardcore porn',
  'adult content',
  'adult material',
  'mature content',
  'nudity',
  'erotica',
  'erotic content',
  'xxx',
  '18+',
];
