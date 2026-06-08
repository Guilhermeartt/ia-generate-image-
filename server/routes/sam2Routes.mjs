const DEFAULT_SAM2_BASE = 'http://127.0.0.1:8791';

const toSam2Error = (message, status = 503) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const resolveBase = () => {
  const explicit = process.env.SAM2_SERVICE_URL;
  if (!explicit) return DEFAULT_SAM2_BASE;
  // accept either base URL or full /segment URL for backward compatibility
  return explicit.replace(/\/segment\/?$/, '');
};

export default function registerSam2Routes(app, { asyncRoute, imageJsonParser }) {
  app.post('/api/sam2/segment', imageJsonParser, asyncRoute(async (req) => {
    const base = resolveBase();
    const { imageBase64, point, positivePoints, negativePoints, box, multimask } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw toSam2Error('Envie imageBase64 para segmentar com SAM 2.', 400);
    }
    const hasPoint = point && typeof point.x === 'number' && typeof point.y === 'number';
    const hasBox = box && typeof box.x === 'number' && typeof box.y === 'number'
      && typeof box.width === 'number' && typeof box.height === 'number';
    if (!hasPoint && !hasBox) {
      throw toSam2Error('Envie point { x, y } ou box { x, y, width, height } (normalizados).', 400);
    }

    let response;
    try {
      response = await fetch(`${base}/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          point: hasPoint ? point : null,
          positivePoints: Array.isArray(positivePoints) ? positivePoints : [],
          negativePoints: Array.isArray(negativePoints) ? negativePoints : [],
          box: hasBox ? box : null,
          multimask: multimask === true,
        }),
      });
    } catch (error) {
      throw toSam2Error(`SAM 2 indisponível em ${base}. Inicie o serviço Python ou configure SAM2_SERVICE_URL.`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw toSam2Error(`SAM 2 respondeu sem JSON válido (${response.status}).`, response.status || 503);
    }

    if (!response.ok) {
      throw toSam2Error(payload?.error || payload?.detail || `SAM 2 retornou erro ${response.status}.`, response.status);
    }
    if (!payload?.maskBase64) {
      throw toSam2Error('SAM 2 não retornou maskBase64.', 502);
    }

    return {
      maskBase64: payload.maskBase64,
      bbox: payload.bbox || null,
      score: payload.score ?? null,
      width: payload.width ?? null,
      height: payload.height ?? null,
      source: 'sam2',
    };
  }));

  app.post('/api/sam2/detect', imageJsonParser, asyncRoute(async (req) => {
    const base = resolveBase();
    const { imageBase64, threshold, maxObjects } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw toSam2Error('Envie imageBase64 para detectar objetos.', 400);
    }

    let response;
    try {
      response = await fetch(`${base}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          threshold: typeof threshold === 'number' ? threshold : 0.7,
          maxObjects: typeof maxObjects === 'number' ? maxObjects : 20,
        }),
      });
    } catch (error) {
      throw toSam2Error(`SAM 2 indisponível em ${base}. Inicie o serviço Python ou configure SAM2_SERVICE_URL.`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw toSam2Error(`SAM 2 respondeu sem JSON válido (${response.status}).`, response.status || 503);
    }

    if (!response.ok) {
      throw toSam2Error(payload?.error || payload?.detail || `Detector retornou erro ${response.status}.`, response.status);
    }
    return {
      objects: Array.isArray(payload?.objects) ? payload.objects : [],
      width: payload?.width ?? null,
      height: payload?.height ?? null,
    };
  }));
}
