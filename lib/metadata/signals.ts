import type { MetadataSignal } from './types';

/**
 * Catalog of metadata-based AI-likelihood signals, one entry per detector.
 * Each `confidence` is "if this pattern is found, how likely is the image AI
 * generated" — including low values for counter-evidence like real camera
 * capture settings, so every detector follows the same "match -> confidence" shape.
 */
export const METADATA_SIGNALS = {
  exifSoftwareVendor: {
    id: 'exif.software.vendor',
    label: 'AI tool name in EXIF Software field',
    description: 'The EXIF Software tag names a known AI image generator',
    confidence: 85,
    category: 'exif',
    parameters: ['Software']
  },
  exifGenerationParameters: {
    id: 'exif.source.terms',
    label: 'Generation parameters in EXIF comment fields',
    description: 'EXIF comment/description fields contain diffusion-model generation parameters (prompt, seed, sampler, ...)',
    confidence: 90,
    category: 'exif',
    parameters: ['UserComment', 'ImageDescription', 'XPComment']
  },
  exifTypicalAiDimension: {
    id: 'exif.dimension.typical',
    label: 'Typical AI image dimensions',
    description: 'Image dimensions match a size diffusion models commonly default to (weak on its own)',
    confidence: 20,
    category: 'exif',
    parameters: ['ExifImageWidth', 'ExifImageHeight', 'ImageWidth', 'ImageHeight']
  },
  exifCameraCapture: {
    id: 'exif.camera.capture',
    label: 'Real camera capture evidence',
    description: 'Make/model, lens and/or capture settings are present — this is most likely a real photo, not AI generated',
    confidence: 5,
    kind: 'authenticity',
    category: 'exif',
    parameters: ['Make', 'Model', 'LensModel', 'LensMake', 'FocalLength', 'ExposureTime', 'FNumber', 'ISO', 'Flash', 'WhiteBalance', 'MeteringMode']
  },
  exifGps: {
    id: 'exif.gps.present',
    label: 'GPS location data present',
    description: 'Real-world GPS coordinates are rarely embedded by AI generators',
    confidence: 5,
    kind: 'authenticity',
    category: 'exif',
    parameters: ['GPSLatitude', 'GPSLongitude', 'GPSAltitude']
  },
  xmpGeneratorVendor: {
    id: 'xmp.creatorTool.vendor',
    label: 'AI tool name in XMP CreatorTool/History',
    description: 'XMP CreatorTool, History, or softwareAgent names a known AI image generator',
    confidence: 90,
    category: 'xmp',
    parameters: ['CreatorTool', 'History', 'DerivedFrom', 'DocumentID', 'InstanceID']
  },
  xmpSourceTerms: {
    id: 'xmp.source.terms',
    label: 'Generation parameters or AI source terms in XMP',
    description: 'XMP fields contain generation parameters (prompt, seed, sampler, ...) or explicit "AI generated" wording',
    confidence: 90,
    category: 'xmp',
    parameters: ['dc:description', 'DigitalSourceType', 'Source']
  },
  iptcGeneratorVendor: {
    id: 'iptc.fields.vendor',
    label: 'AI tool name in IPTC caption/credit fields',
    description: 'IPTC Caption, Credit, Source or Special Instructions name a known AI image generator',
    confidence: 80,
    category: 'iptc',
    parameters: ['Caption', 'Credit', 'Source', 'SpecialInstructions', 'Keywords']
  },
  iptcCameraCapture: {
    id: 'iptc.source.camera',
    label: 'Camera capture wording in IPTC',
    description: 'IPTC Source/Credit explicitly describes a camera/digital capture',
    confidence: 10,
    kind: 'authenticity',
    category: 'iptc',
    parameters: ['Source', 'Credit']
  },
  iccVendorProfile: {
    id: 'icc.profile.vendor',
    label: 'AI tool name in ICC profile description',
    description: 'The embedded ICC color profile description names a known AI image generator (rare, but seen in some exports)',
    confidence: 60,
    category: 'icc',
    parameters: ['ProfileDescription', 'Copyright']
  },
  jfifPresent: {
    id: 'jfif.present',
    label: 'JFIF marker present',
    description: 'A JFIF (APP0) segment is common in standard JPEG encoders; on its own this says little either way',
    confidence: 10,
    category: 'jfif',
    parameters: ['JFIFVersion', 'ResolutionUnit', 'XResolution', 'YResolution']
  },
  ihdrTypicalAiDimension: {
    id: 'ihdr.dimension.typical',
    label: 'Typical AI image dimensions (PNG)',
    description: 'PNG IHDR width/height match a size diffusion models commonly default to (weak on its own)',
    confidence: 25,
    category: 'ihdr',
    parameters: ['ImageWidth', 'ImageHeight', 'BitDepth', 'ColorType']
  }
} as const satisfies Record<string, MetadataSignal>;
