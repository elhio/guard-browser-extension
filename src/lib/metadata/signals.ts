import type { MetadataSignal } from './types';

/**
 * The master catalog of all metadata-based detection heuristics (signals)
 *
 * Note: Each entry represents a specific pattern evaluated by a format-specific detector
 * - `category`: What we are detecting (e.g., 'aiGenerated')
 * - `standard`: Where we are looking for it (e.g., 'exif', 'xmp')
 * - `confidence`: How strongly this signal indicates the presence of the `category` (0-100)
 */
export const METADATA_SIGNALS = {
  exifSoftwareVendor: {
    id: 'exif.software.vendor',
    category: 'aiGenerated',
    label: 'AI tool name in EXIF Software field',
    description: 'The EXIF Software tag names a known AI image generator',
    confidence: 85,
    standard: 'exif',
    parameters: ['Software']
  },
  exifGenerationParameters: {
    id: 'exif.source.terms',
    category: 'aiGenerated',
    label: 'Generation parameters in EXIF comment fields',
    description: 'EXIF comment/description fields contain diffusion-model generation parameters (prompt, seed, sampler, ...)',
    confidence: 90,
    standard: 'exif',
    parameters: ['UserComment', 'ImageDescription', 'XPComment']
  },
  exifTypicalAiDimension: {
    id: 'exif.dimension.typical',
    category: 'aiGenerated',
    label: 'Typical AI image dimensions',
    description: 'Image dimensions match a size diffusion models commonly default to (weak on its own)',
    confidence: 20,
    standard: 'exif',
    parameters: ['ExifImageWidth', 'ExifImageHeight', 'ImageWidth', 'ImageHeight']
  },
  exifCameraCapture: {
    id: 'exif.camera.capture',
    category: 'aiGenerated',
    label: 'Real camera capture evidence',
    description: 'Make/model, lens and/or capture settings are present — this is most likely a real photo, not AI generated',
    confidence: 5,
    kind: 'authentic',
    standard: 'exif',
    parameters: ['Make', 'Model', 'LensModel', 'LensMake', 'FocalLength', 'ExposureTime', 'FNumber', 'ISO', 'Flash', 'WhiteBalance', 'MeteringMode']
  },
  exifGps: {
    id: 'exif.gps.present',
    category: 'aiGenerated',
    label: 'GPS location data present',
    description: 'Real-world GPS coordinates are rarely embedded by AI generators',
    confidence: 5,
    kind: 'authentic',
    standard: 'exif',
    parameters: ['GPSLatitude', 'GPSLongitude', 'GPSAltitude']
  },
  xmpGeneratorVendor: {
    id: 'xmp.creatorTool.vendor',
    category: 'aiGenerated',
    label: 'AI tool name in XMP CreatorTool/History',
    description: 'XMP CreatorTool, History, or softwareAgent names a known AI image generator',
    confidence: 90,
    standard: 'xmp',
    parameters: ['CreatorTool', 'History', 'DerivedFrom', 'DocumentID', 'InstanceID']
  },
  xmpSourceTerms: {
    id: 'xmp.source.terms',
    category: 'aiGenerated',
    label: 'Generation parameters or AI source terms in XMP',
    description: 'XMP fields contain generation parameters (prompt, seed, sampler, ...) or explicit "AI generated" wording',
    confidence: 90,
    standard: 'xmp',
    parameters: ['dc:description', 'DigitalSourceType', 'Source']
  },
  iptcGeneratorVendor: {
    id: 'iptc.fields.vendor',
    category: 'aiGenerated',
    label: 'AI tool name in IPTC caption/credit fields',
    description: 'IPTC Caption, Credit, Source or Special Instructions name a known AI image generator',
    confidence: 80,
    standard: 'iptc',
    parameters: ['Caption', 'Credit', 'Source', 'SpecialInstructions', 'Keywords']
  },
  iptcCameraCapture: {
    id: 'iptc.source.camera',
    category: 'aiGenerated',
    label: 'Camera capture wording in IPTC',
    description: 'IPTC Source/Credit explicitly describes a camera/digital capture',
    confidence: 10,
    kind: 'authentic',
    standard: 'iptc',
    parameters: ['Source', 'Credit']
  },
  iccVendorProfile: {
    id: 'icc.profile.vendor',
    category: 'aiGenerated',
    label: 'AI tool name in ICC profile description',
    description: 'The embedded ICC color profile description names a known AI image generator (rare, but seen in some exports)',
    confidence: 60,
    standard: 'icc',
    parameters: ['ProfileDescription', 'Copyright']
  },
  jfifPresent: {
    id: 'jfif.present',
    category: 'aiGenerated',
    label: 'JFIF marker present',
    description: 'A JFIF (APP0) segment is common in standard JPEG encoders; on its own this says little either way',
    confidence: 10,
    standard: 'jfif',
    parameters: ['JFIFVersion', 'ResolutionUnit', 'XResolution', 'YResolution']
  },
  ihdrTypicalAiDimension: {
    id: 'ihdr.dimension.typical',
    category: 'aiGenerated',
    label: 'Typical AI image dimensions (PNG)',
    description: 'PNG IHDR width/height match a size diffusion models commonly default to (weak on its own)',
    confidence: 25,
    standard: 'ihdr',
    parameters: ['ImageWidth', 'ImageHeight', 'BitDepth', 'ColorType']
  },
  iptcViolentContent: {
    id: 'iptc.content.violent',
    category: 'violent',
    label: 'Violent content wording in IPTC',
    description: 'IPTC keywords/caption/category fields describe violent or graphic content',
    confidence: 70,
    kind: 'violence',
    standard: 'iptc',
    parameters: ['Keywords', 'Caption', 'Category', 'SupplementalCategories', 'Headline']
  },
  iptcExplicitContent: {
    id: 'iptc.content.explicit',
    category: 'explicit',
    label: 'Explicit content wording in IPTC',
    description: 'IPTC keywords/caption/category fields describe sexually explicit or adult content',
    confidence: 80,
    kind: 'explicit',
    standard: 'iptc',
    parameters: ['Keywords', 'Caption', 'Category', 'SupplementalCategories', 'Headline']
  },
  xmpViolentContent: {
    id: 'xmp.content.violent',
    category: 'violent',
    label: 'Violent content wording in XMP',
    description: 'XMP subject/description/title fields describe violent or graphic content',
    confidence: 70,
    kind: 'violence',
    standard: 'xmp',
    parameters: ['dc:subject', 'dc:description', 'dc:title', 'Rating']
  },
  xmpExplicitContent: {
    id: 'xmp.content.explicit',
    category: 'explicit',
    label: 'Explicit content wording in XMP',
    description: 'XMP subject/description/title fields describe sexually explicit or adult content',
    confidence: 80,
    kind: 'explicit',
    standard: 'xmp',
    parameters: ['dc:subject', 'dc:description', 'dc:title', 'Rating']
  },
  exifViolentContent: {
    id: 'exif.content.violent',
    category: 'violent',
    label: 'Violent content wording in EXIF description',
    description: 'EXIF description/comment/keyword fields describe violent or graphic content',
    confidence: 70,
    kind: 'violence',
    standard: 'exif',
    parameters: ['ImageDescription', 'UserComment', 'XPComment', 'XPKeywords', 'XPSubject']
  },
  exifExplicitContent: {
    id: 'exif.content.explicit',
    category: 'explicit',
    label: 'Explicit content wording in EXIF description',
    description: 'EXIF description/comment/keyword fields describe sexually explicit or adult content',
    confidence: 80,
    kind: 'explicit',
    standard: 'exif',
    parameters: ['ImageDescription', 'UserComment', 'XPComment', 'XPKeywords', 'XPSubject']
  }
} as const satisfies Record<string, MetadataSignal>;