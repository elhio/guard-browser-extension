/**
 * FFT-Analysis Utility für Javascript/TypeScript
 * 
 * Diese Datei enthält einen eigenständigen Radix-2 Cooley-Tukey FFT-Algorithmus (2D),
 * um Frequenz-Schachbrettmuster (Checkerboard-Artefakte) in Bildern zu erkennen.
 * Diese Artefakte entstehen typischerweise bei der Bildgenerierung durch KIs
 * (GANs und Diffusionsmodelle) im Up-Sampling-Prozess.
 * 
 * Diese Datei kann einfach kopiert und in andere Web- oder NodeJS-Projekte integriert werden.
 */

/**
 * Führt eine Bit-Reversal-Permutation durch.
 */
function bitReverse(x: number, bits: number): number {
  let y = 0;
  for (let i = 0; i < bits; i++) {
    y = (y << 1) | (x & 1);
    x >>= 1;
  }
  return y;
}

/**
 * 1D Fast Fourier Transform (Cooley-Tukey, In-Place Radix-2)
 */
export function fft1D(re: Float32Array, im: Float32Array) {
  const n = re.length;
  const bits = Math.round(Math.log2(n));

  for (let i = 0; i < n; i++) {
    const j = bitReverse(i, bits);
    if (i < j) {
      let temp = re[i]; re[i] = re[j]; re[j] = temp;
      temp = im[i]; im[i] = im[j]; im[j] = temp;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wreal = Math.cos(ang);
    const wimag = -Math.sin(ang);

    for (let i = 0; i < n; i += len) {
      let ur = 1;
      let ui = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const k = i + j + half;
        const tr = re[k] * ur - im[k] * ui;
        const ti = re[k] * ui + im[k] * ur;
        re[k] = re[i + j] - tr;
        im[k] = im[i + j] - ti;
        re[i + j] += tr;
        im[i + j] += ti;
        const next_ur = ur * wreal - ui * wimag;
        ui = ur * wimag + ui * wreal;
        ur = next_ur;
      }
    }
  }
}

/**
 * Berechnet die 2D-Fourier-Transformation für ein reelles Pixel-Array.
 * Gibt das Amplitudenspektrum (Magnitude) zurück.
 */
export function compute2DFFT(pixels: Float32Array, width: number, height: number): Float32Array {
  const size = width * height;
  const re = new Float32Array(size);
  const im = new Float32Array(size);
  re.set(pixels);

  // 1. Zeilenweise 1D-FFT
  for (let y = 0; y < height; y++) {
    const rowRe = new Float32Array(width);
    const rowIm = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      rowRe[x] = re[y * width + x];
    }
    fft1D(rowRe, rowIm);
    for (let x = 0; x < width; x++) {
      re[y * width + x] = rowRe[x];
      im[y * width + x] = rowIm[x];
    }
  }

  // 2. Spaltenweise 1D-FFT
  for (let x = 0; x < width; x++) {
    const colRe = new Float32Array(height);
    const colIm = new Float32Array(height);
    for (let y = 0; y < height; y++) {
      colRe[y] = re[y * width + x];
      colIm[y] = im[y * width + x];
    }
    fft1D(colRe, colIm);
    for (let y = 0; y < height; y++) {
      re[y * width + x] = colRe[y];
      im[y * width + x] = colIm[y];
    }
  }

  // 3. Magnitudenspektrum berechnen
  const magnitude = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    magnitude[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }

  return magnitude;
}

/**
 * Verschiebt die niedrigen Frequenzen in das Zentrum des Spektrums (Quadranten-Tausch).
 */
export function shiftSpectrum(mag: Float32Array, w: number, h: number): Float32Array {
  const shifted = new Float32Array(w * h);
  const halfW = w >> 1;
  const halfH = h >> 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const newX = (x + halfW) % w;
      const newY = (y + halfH) % h;
      shifted[newY * w + newX] = mag[y * w + x];
    }
  }
  return shifted;
}

/**
 * Analysiert das Bild auf künstliche, periodische Frequenz-Spitzen (AI Artifact Detection).
 * 
 * @param canvas Das HTML5-Canvas Element des Bildes.
 * @returns Ein Score zwischen 0 und 100, der die KI-Frequenzwahrscheinlichkeit angibt.
 */
export function detectAIFrequencies(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  // Wir erzwingen eine feste Größe von 128x128 Pixeln
  // (optimale Balance zwischen FFT-Genauigkeit und Performance)
  const N = 128;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = N;
  tempCanvas.height = N;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(canvas, 0, 0, N, N);

  const imgData = tempCtx.getImageData(0, 0, N, N);
  const data = imgData.data;

  // 1. In Graustufen umwandeln
  const gray = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // 2. 2D FFT berechnen
  const magnitude = compute2DFFT(gray, N, N);

  // 3. Frequenz-Zentrum verschieben
  const shifted = shiftSpectrum(magnitude, N, N);

  // 4. Logarithmische Skalierung zur Rauschunterdrückung
  const logSpectrum = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    logSpectrum[i] = Math.log(1 + shifted[i]);
  }

  // 5. Statistische Analyse im Hochfrequenzbereich
  const center = N >> 1;
  const rMin = 15; // Tiefe Frequenzen im Kern überspringen
  const rMax = 60; // Äußerste Ränder wegen Bildkompression ignorieren

  let highFreqSum = 0;
  let highFreqCount = 0;

  // Mittelwert berechnen
  for (let y = 0; y < N; y++) {
    const dy = y - center;
    for (let x = 0; x < N; x++) {
      const dx = x - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= rMin && dist <= rMax) {
        highFreqSum += logSpectrum[y * N + x];
        highFreqCount++;
      }
    }
  }

  if (highFreqCount === 0) return 0;
  const avg = highFreqSum / highFreqCount;

  // Standardabweichung (Rauschen) berechnen
  let varianceSum = 0;
  for (let y = 0; y < N; y++) {
    const dy = y - center;
    for (let x = 0; x < N; x++) {
      const dx = x - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= rMin && dist <= rMax) {
        const diff = logSpectrum[y * N + x] - avg;
        varianceSum += diff * diff;
      }
    }
  }
  const stdDev = Math.sqrt(varianceSum / highFreqCount);

  // 6. Anomalie-Erkennung (Lokale Peaks suchen)
  let peakScore = 0;
  const detectedPeaks = new Set<string>();

  for (let y = 2; y < N - 2; y++) {
    const dy = y - center;
    for (let x = 2; x < N - 2; x++) {
      const dx = x - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= rMin && dist <= rMax) {
        const val = logSpectrum[y * N + x];

        // Muss min. 3.0 Standardabweichungen über dem Rauschen liegen
        if (val > avg + 3.0 * stdDev) {
          // Lokales Maximum in 5x5 Nachbarschaft prüfen
          let isMax = true;
          for (let ny = -2; ny <= 2; ny++) {
            for (let nx = -2; nx <= 2; nx++) {
              if (ny === 0 && nx === 0) continue;
              if (logSpectrum[(y + ny) * N + (x + nx)] >= val) {
                isMax = false;
                break;
              }
            }
            if (!isMax) break;
          }

          if (isMax) {
            // Symmetrischen Peak auf der gegenüberliegenden Seite prüfen
            const symX = center - dx;
            const symY = center - dy;
            let hasSymmetry = false;

            // Toleranzbereich von 3x3 Pixeln suchen
            for (let sy = -1; sy <= 1; sy++) {
              for (let sx = -1; sx <= 1; sx++) {
                if (logSpectrum[(symY + sy) * N + (symX + sx)] > avg + 2.5 * stdDev) {
                  hasSymmetry = true;
                  break;
                }
              }
              if (hasSymmetry) break;
            }

            const peakKey = `${x},${y}`;
            if (!detectedPeaks.has(peakKey)) {
              detectedPeaks.add(peakKey);
              const excess = (val - (avg + 3.0 * stdDev)) / (stdDev || 1);
              // Symmetrische Spitzen werden als stärkere KI-Indikatoren gewichtet
              peakScore += hasSymmetry ? excess * 2.0 : excess * 0.5;
            }
          }
        }
      }
    }
  }

  // Score in Prozent umwandeln (Normalwerte: < 1.0; KI-Gitter: 5.0 - 50.0+)
  const probability = Math.min(100, Math.max(0, Math.round((peakScore / 6.0) * 100)));
  return probability;
}
