import sharp from 'sharp';

const RATIO_VALUES = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
};

const ratioToDimensions = (aspectRatio, baseSize = 1536) => {
  switch (aspectRatio) {
    case '9:16': return { width: 864, height: 1536 };
    case '1:1': return { width: 1536, height: 1536 };
    case '4:3': return { width: 1536, height: 1152 };
    case '3:4': return { width: 1152, height: 1536 };
    case '16:9':
    default: return { width: baseSize, height: Math.round(baseSize * 9 / 16) };
  }
};

const normalizeMode = (mode) => (
  ['cover', 'contain', 'blur'].includes(mode) ? mode : 'cover'
);

export const isSupportedAspectRatio = (aspectRatio) => Boolean(RATIO_VALUES[aspectRatio]);

export const enforceAspectRatio = async ({
  base64Data,
  mimeType = 'image/png',
  aspectRatio = '16:9',
  mode = 'cover',
  tolerance = 0.02,
}) => {
  if (!base64Data || !isSupportedAspectRatio(aspectRatio)) {
    return { base64Data, mimeType, aspectRatioCorrected: false };
  }

  const input = Buffer.from(base64Data, 'base64');
  const image = sharp(input, { failOn: 'none' }).rotate();
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    return { base64Data, mimeType, aspectRatioCorrected: false };
  }

  const targetRatio = RATIO_VALUES[aspectRatio];
  const currentRatio = metadata.width / metadata.height;

  if (Math.abs(currentRatio - targetRatio) <= tolerance) {
    return { base64Data, mimeType, aspectRatioCorrected: false };
  }

  const { width, height } = ratioToDimensions(aspectRatio);
  const fitMode = normalizeMode(mode);
  let output;

  if (fitMode === 'contain') {
    output = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize(width, height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .png()
      .toBuffer();
  } else if (fitMode === 'blur') {
    const background = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'attention' })
      .blur(28)
      .modulate({ brightness: 0.72, saturation: 0.85 })
      .png()
      .toBuffer();

    const foreground = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize(width, height, { fit: 'contain' })
      .png()
      .toBuffer();

    output = await sharp(background)
      .composite([{ input: foreground, gravity: 'center' }])
      .png()
      .toBuffer();
  } else {
    output = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'attention' })
      .png()
      .toBuffer();
  }

  return {
    base64Data: output.toString('base64'),
    mimeType: 'image/png',
    aspectRatioCorrected: true,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
    width,
    height,
  };
};
