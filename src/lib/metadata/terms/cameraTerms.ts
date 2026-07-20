/**
 * A curated list of major digital camera and smartphone manufacturers
 */
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

/**
 * EXIF field names that explicitly define physical camera lens properties
 */
export const LENS_FIELD_NAMES: readonly string[] = [
  'lensmodel',
  'lensmake',
  'lens',
  'focallength'
];

/**
 * EXIF field names that describe physical exposure mechanics and camera settings
 */
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

/**
 * EXIF and GPS-segment field names that denote real-world geographic coordinates
 */
export const GPS_FIELD_NAMES: readonly string[] = [
  'gps',
  'latitude',
  'longitude',
  'gpslatitude',
  'gpslongitude'
];