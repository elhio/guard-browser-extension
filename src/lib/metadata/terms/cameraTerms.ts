/** Camera/phone manufacturer names, as they appear in EXIF Make/Model fields. */
export const CAMERA_MAKE_MODEL_TERMS: readonly string[] = [
  'apple',
  'iphone',
  'canon',
  'nikon',
  'sony',
  'fujifilm',
  'fuji',
  'panasonic',
  'leica',
  'olympus',
  'om system',
  'pentax',
  'ricoh',
  'hasselblad',
  'samsung',
  'google',
  'pixel',
  'xiaomi',
  'huawei',
  'honor',
  'oppo',
  'vivo',
  'dji',
  'gopro'
];

/** EXIF field names that indicate lens information (real optics, not a generator). */
export const LENS_FIELD_NAMES: readonly string[] = ['lensmodel', 'lensmake', 'lens', 'focallength'];

/** EXIF field names that indicate real capture settings (exposure, ISO, etc.). */
export const CAPTURE_SETTING_FIELD_NAMES: readonly string[] = [
  'exposuretime',
  'fnumber',
  'iso',
  'isospeedratings',
  'focallength',
  'flash',
  'whitebalance',
  'meteringmode'
];

/** EXIF/GPS field names that indicate the asset carries real-world location data. */
export const GPS_FIELD_NAMES: readonly string[] = ['gps', 'latitude', 'longitude', 'gpslatitude', 'gpslongitude'];