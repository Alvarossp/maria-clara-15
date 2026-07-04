/* ==========================================================================
   MARIA CLARA 15 — SCRIPT.JS
   Lógica completa: câmera, composição em Canvas, captura, compartilhamento,
   download e PWA.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     0. CONFIGURAÇÃO
  ------------------------------------------------------------------------ */
  const CONFIG = {
    canvasWidth: 1080,
    canvasHeight: 1920,
    fileName: 'MariaClara15.png',
    partyDateLabel: '4 de Julho de 2026',
    colors: {
      gold: '#C9A66B',
      goldBright: '#E8C97E',
      white: '#FFFFFF',
      ink: 'rgba(74, 59, 51, 0.28)'
    },
    decorAssets: {
      crest: 'assets/svg/brasao-mc.svg',
      flower1: 'assets/svg/flor-01.svg',
      flower2: 'assets/svg/flor-02.svg',
      balloon1: 'assets/svg/balao-01.svg',
      balloon2: 'assets/svg/balao-02.svg'
    },
    confettiCount: 34,
    glitterCount: 26,
    confettiColors: ['#C9A66B', '#E8C97E', '#F4C9A8', '#AFC9E0', '#FBE3D2']
  };

  /* ------------------------------------------------------------------------
     1. REFERÊNCIAS DO DOM (cacheadas uma única vez)
  ------------------------------------------------------------------------ */
  const dom = {
    loadingScreen: document.getElementById('loading-screen'),
    loadingBarFill: document.getElementById('loading-bar-fill'),
    permissionScreen: document.getElementById('permission-screen'),
    btnRequestPermission: document.getElementById('btn-request-permission'),
    permissionHint: document.getElementById('permission-hint'),
    stage: document.getElementById('stage'),
    cameraFrame: document.getElementById('camera-frame'),
    video: document.getElementById('camera-video'),
    canvas: document.getElementById('capture-canvas'),
    confettiField: document.getElementById('confetti-field'),
    glitterField: document.getElementById('glitter-field'),
    frameDate: document.getElementById('frame-date'),
    btnSwitchCamera: document.getElementById('btn-switch-camera'),
    btnCapture: document.getElementById('btn-capture'),
    btnInfo: document.getElementById('btn-info'),
    resultScreen: document.getElementById('result-screen'),
    resultImage: document.getElementById('result-image'),
    btnRetake: document.getElementById('btn-retake'),
    btnShare: document.getElementById('btn-share'),
    btnDownload: document.getElementById('btn-download'),
    infoModal: document.getElementById('info-modal'),
    infoBackdrop: document.getElementById('info-backdrop'),
    btnCloseInfo: document.getElementById('btn-close-info'),
    toast: document.getElementById('toast')
  };

  /* ------------------------------------------------------------------------
     2. ESTADO GLOBAL DA APLICAÇÃO
  ------------------------------------------------------------------------ */
  const state = {
    stream: null,
    facingMode: 'user',
    isSwitchingCamera: false,
    isCapturing: false,
    decorImages: {},
    decorImagesReady: false,
    fontsReady: false,
    lastResultBlob: null,
    toastTimer: null,
    platform: detectPlatform()
  };

  /* ------------------------------------------------------------------------
     3. DETECÇÃO DE PLATAFORMA
  ------------------------------------------------------------------------ */
  function detectPlatform() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    document.documentElement.classList.add(isIOS ? 'is-ios' : isAndroid ? 'is-android' : 'is-desktop');
    return { isIOS, isAndroid };
  }

  /* ------------------------------------------------------------------------
     4. TOAST DE FEEDBACK
  ------------------------------------------------------------------------ */
  function showToast(message, duration) {
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }
    dom.toast.textContent = message;
    dom.toast.classList.remove('hidden');
    // Força reflow para garantir que a transição de entrada ocorra
    void dom.toast.offsetWidth;
    dom.toast.classList.add('visible');

    state.toastTimer = setTimeout(() => {
      dom.toast.classList.remove('visible');
      setTimeout(() => dom.toast.classList.add('hidden'), 220);
    }, duration || 2600);
  }

  /* ------------------------------------------------------------------------
     5. PRÉ-CARREGAMENTO DE FONTES E IMAGENS
  ------------------------------------------------------------------------ */
  function loadFonts() {
    if (!('fonts' in document)) {
      state.fontsReady = true;
      return Promise.resolve();
    }
    const specs = [
      '600 40px "Playfair Display"',
      'italic 500 32px "Playfair Display"',
      '400 36px "Cormorant Garamond"',
      '400 48px "Parisienne"'
    ];
    return Promise.all(specs.map((spec) => document.fonts.load(spec)))
      .then(() => document.fonts.ready)
      .then(() => { state.fontsReady = true; })
      .catch(() => { state.fontsReady = true; });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Falha ao carregar imagem: ' + src));
      img.decoding = 'async';
      img.src = src;
    });
  }

  function loadDecorImages() {
    const entries = Object.entries(CONFIG.decorAssets);
    return Promise.all(
      entries.map(([key, src]) =>
        loadImage(src)
          .then((img) => { state.decorImages[key] = img; })
          .catch((err) => { console.warn(err.message); })
      )
    ).then(() => { state.decorImagesReady = true; });
  }

  /* ------------------------------------------------------------------------
     6. PARTÍCULAS DECORATIVAS (DOM, animadas via CSS — leves para 60 FPS)
  ------------------------------------------------------------------------ */
  function buildConfettiField() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < CONFIG.confettiCount; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const left = Math.random() * 100;
      const duration = 5 + Math.random() * 5;
      const delay = Math.random() * -10;
      const drift = (Math.random() * 80 - 40).toFixed(0) + 'px';
      const color = CONFIG.confettiColors[i % CONFIG.confettiColors.length];
      const rotate = Math.random() > 0.5;

      piece.style.left = left + 'vw';
      piece.style.background = color;
      piece.style.animationDuration = duration + 's';
      piece.style.animationDelay = delay + 's';
      piece.style.setProperty('--drift', drift);
      if (rotate) {
        piece.style.borderRadius = '50%';
      }
      fragment.appendChild(piece);
    }
    dom.confettiField.appendChild(fragment);
  }

  function buildGlitterField() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < CONFIG.glitterCount; i++) {
      const dot = document.createElement('span');
      dot.className = 'glitter-particle';
      const top = Math.random() * 100;
      const left = Math.random() * 100;
      const duration = 1.8 + Math.random() * 2.4;
      const delay = Math.random() * -4;

      dot.style.top = top + 'vh';
      dot.style.left = left + 'vw';
      dot.style.animationDuration = duration + 's';
      dot.style.animationDelay = delay + 's';
      fragment.appendChild(dot);
    }
    dom.glitterField.appendChild(fragment);
  }

  /* ------------------------------------------------------------------------
     7. SEQUÊNCIA DE CARREGAMENTO
  ------------------------------------------------------------------------ */
  function setLoadingProgress(percent) {
    dom.loadingBarFill.style.width = Math.min(100, Math.max(0, percent)) + '%';
  }

  async function runLoadingSequence() {
    setLoadingProgress(10);
    dom.frameDate.textContent = CONFIG.partyDateLabel;

    await loadFonts();
    setLoadingProgress(45);

    await loadDecorImages();
    setLoadingProgress(75);

    buildConfettiField();
    buildGlitterField();
    setLoadingProgress(100);

    await wait(280);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ------------------------------------------------------------------------
     7b. AJUSTE DO FRAME DE CÂMERA (WYSIWYG)
     O #camera-frame é dimensionado em pixels reais para ter exatamente
     a proporção 9:16 do Canvas de captura (1080x1920). Sem isso, em
     qualquer aparelho cuja tela não seja 9:16 (a maioria não é), a
     posição das flores/balões/moldura no preview não bateria com a
     posição na foto final.
  ------------------------------------------------------------------------ */
  let resizeDebounceTimer = null;

  function fitCameraFrame() {
    const targetRatio = CONFIG.canvasWidth / CONFIG.canvasHeight;
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight;

    let frameWidth = availableWidth;
    let frameHeight = frameWidth / targetRatio;

    if (frameHeight > availableHeight) {
      frameHeight = availableHeight;
      frameWidth = frameHeight * targetRatio;
    }

    frameWidth = Math.round(frameWidth);
    frameHeight = Math.round(frameHeight);

    dom.cameraFrame.style.width = frameWidth + 'px';
    dom.cameraFrame.style.height = frameHeight + 'px';

    // Usado pelo keyframe de queda do confete (transform:% é relativo
    // ao próprio elemento, não ao contêiner — por isso a variável em px)
    document.documentElement.style.setProperty('--frame-height', frameHeight + 'px');
  }

  function scheduleFitCameraFrame() {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(fitCameraFrame, 120);
  }

  /* ------------------------------------------------------------------------
     8. CÂMERA
  ------------------------------------------------------------------------ */
  function stopStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  async function getConstraints(facingMode, exact) {
    // Valores consistentes entre si (9:16) — hints conflitantes entre
    // width/height/aspectRatio confundem o seletor de resolução em
    // alguns aparelhos Android, resultando em cortes inesperados.
    const videoConstraints = {
      width: { ideal: CONFIG.canvasWidth },
      height: { ideal: CONFIG.canvasHeight },
      aspectRatio: { ideal: CONFIG.canvasWidth / CONFIG.canvasHeight }
    };
    videoConstraints.facingMode = exact ? { exact: facingMode } : facingMode;
    return { audio: false, video: videoConstraints };
  }

  async function startCamera(facingMode) {
    // Interrompe qualquer stream anterior antes de solicitar um novo
    // (evita vazamento de memória e o indicador de câmera ficar ativo)
    stopStream(state.stream);
    state.stream = null;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(await getConstraints(facingMode, true));
    } catch (errExact) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(await getConstraints(facingMode, false));
      } catch (errFallback) {
        throw errFallback;
      }
    }

    state.stream = stream;
    state.facingMode = facingMode;
    dom.video.srcObject = stream;
    dom.video.classList.toggle('mirrored', facingMode === 'user');

    await new Promise((resolve) => {
      if (dom.video.readyState >= 2) {
        resolve();
      } else {
        dom.video.onloadedmetadata = () => resolve();
      }
    });

    try {
      await dom.video.play();
    } catch (playErr) {
      // Alguns navegadores exigem gesto do usuário; o botão de captura
      // já garante isso em interações subsequentes.
      console.warn('Reprodução automática bloqueada:', playErr);
    }
  }

  async function initCameraFlow() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showPermissionScreen('Este navegador não tem suporte à câmera. Tente abrir em um navegador atualizado.');
      return;
    }

    try {
      await startCamera('user');
      showStage();
    } catch (err) {
      handleCameraError(err);
    }
  }

  function handleCameraError(err) {
    const name = err && err.name;
    let message = 'Não foi possível acessar a câmera. Toque para tentar novamente.';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      message = 'Permissão de câmera negada. Habilite o acesso nas configurações do navegador e tente novamente.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      message = 'Nenhuma câmera foi encontrada neste dispositivo.';
    } else if (name === 'NotReadableError') {
      message = 'A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.';
    }

    showPermissionScreen(message);
  }

  function showPermissionScreen(hint) {
    dom.permissionHint.textContent = hint || '';
    dom.loadingScreen.classList.add('hidden');
    dom.stage.classList.add('hidden');
    dom.permissionScreen.classList.remove('hidden');
  }

  function showStage() {
    dom.permissionScreen.classList.add('hidden');
    dom.loadingScreen.classList.add('hidden');
    dom.stage.classList.remove('hidden');
  }

  async function switchCamera() {
    if (state.isSwitchingCamera) return;
    state.isSwitchingCamera = true;
    dom.btnSwitchCamera.disabled = true;

    const nextFacingMode = state.facingMode === 'user' ? 'environment' : 'user';
    try {
      await startCamera(nextFacingMode);
    } catch (err) {
      showToast('Não foi possível alternar a câmera.');
      console.warn(err);
    } finally {
      state.isSwitchingCamera = false;
      dom.btnSwitchCamera.disabled = false;
    }
  }

  /* ------------------------------------------------------------------------
     9. COMPOSIÇÃO NO CANVAS (vídeo + moldura + decoração + textos)
  ------------------------------------------------------------------------ */
  function getCoverRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = targetWidth / targetHeight;
    let sx, sy, sWidth, sHeight;

    if (sourceRatio > targetRatio) {
      sHeight = sourceHeight;
      sWidth = sourceHeight * targetRatio;
      sx = (sourceWidth - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = sourceWidth;
      sHeight = sourceWidth / targetRatio;
      sx = 0;
      sy = (sourceHeight - sHeight) / 2;
    }
    return { sx, sy, sWidth, sHeight };
  }

  function drawVideoFrame(ctx, video, w, h, mirrored) {
    const { sx, sy, sWidth, sHeight } = getCoverRect(video.videoWidth, video.videoHeight, w, h);

    ctx.save();
    if (mirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, w, h);
    ctx.restore();
  }

  function drawTopFrame(ctx, w, h) {
    const gradientHeight = h * 0.16;
    const gradient = ctx.createLinearGradient(0, 0, 0, gradientHeight);
    gradient.addColorStop(0, 'rgba(74, 59, 51, 0.32)');
    gradient.addColorStop(1, 'rgba(74, 59, 51, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, gradientHeight);

    const crest = state.decorImages.crest;
    const crestSize = w * 0.09;
    const crestX = (w - crestSize) / 2;
    const crestY = h * 0.028;

    if (crest) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 10;
      ctx.drawImage(crest, crestX, crestY, crestSize, crestSize);
      ctx.restore();
    }

    const titleY = crestY + crestSize + h * 0.052;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '400 ' + Math.round(w * 0.095) + 'px "Parisienne", cursive';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 12;
    ctx.fillText('Maria Clara', w / 2, titleY);

    const subtitleY = titleY + h * 0.024;
    ctx.font = '600 ' + Math.round(w * 0.026) + 'px "Playfair Display", serif';
    ctx.fillStyle = CONFIG.colors.goldBright;
    ctx.shadowBlur = 8;
    drawLetterSpacedText(ctx, '15 ANOS', w / 2, subtitleY, w * 0.012);
    ctx.shadowBlur = 0;
  }

  function drawLetterSpacedText(ctx, text, centerX, y, spacing) {
    const letters = text.split('');
    const widths = letters.map((letter) => ctx.measureText(letter).width);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * (letters.length - 1);
    let cursorX = centerX - totalWidth / 2;
    const originalAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    letters.forEach((letter, index) => {
      ctx.fillText(letter, cursorX, y);
      cursorX += widths[index] + spacing;
    });
    ctx.textAlign = originalAlign;
  }

  function drawBottomFrame(ctx, w, h) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'italic 400 ' + Math.round(w * 0.032) + 'px "Cormorant Garamond", serif';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    ctx.fillText(CONFIG.partyDateLabel, w / 2, h - h * 0.155);
    ctx.restore();
  }

  function drawCorners(ctx, w, h) {
    const flower1 = state.decorImages.flower1;
    const flower2 = state.decorImages.flower2;
    const balloon1 = state.decorImages.balloon1;
    const balloon2 = state.decorImages.balloon2;

    const flowerSize = w * 0.32;
    if (flower1) {
      drawRotated(ctx, flower1, -w * 0.06, h * 0.05, flowerSize, flowerSize, -0.05);
    }
    if (flower2) {
      drawRotated(ctx, flower2, w - flowerSize + w * 0.06, h * 0.80, flowerSize, flowerSize, 0.05);
    }

    const balloonSize = w * 0.19;
    if (balloon1) {
      drawRotated(ctx, balloon1, w * 0.02, h * 0.60, balloonSize, balloonSize * 1.5, -0.03);
    }
    if (balloon2) {
      drawRotated(ctx, balloon2, w - balloonSize - w * 0.02, h * 0.58, balloonSize, balloonSize * 1.5, 0.03);
    }
  }

  function drawRotated(ctx, image, x, y, w, h, angle) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(angle);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawStaticGlitter(ctx, w, h, count) {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h * 0.85;
      const radius = 1.5 + Math.random() * 2.5;
      ctx.beginPath();
      ctx.fillStyle = CONFIG.colors.goldBright;
      ctx.shadowColor = CONFIG.colors.goldBright;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.55 + Math.random() * 0.45;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStaticConfetti(ctx, w, h, count) {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = 8 + Math.random() * 8;
      const angle = Math.random() * Math.PI * 2;
      const color = CONFIG.confettiColors[i % CONFIG.confettiColors.length];

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-size / 2, -size / 4, size, size / 2);
      ctx.restore();
    }
    ctx.restore();
  }

  async function composeFinalImage() {
    const canvas = dom.canvas;
    const ctx = canvas.getContext('2d');
    const w = CONFIG.canvasWidth;
    const h = CONFIG.canvasHeight;

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    // 1. Vídeo (fundo)
    drawVideoFrame(ctx, dom.video, w, h, state.facingMode === 'user');

    // 2. Decoração estática (confete e glitter "congelados" no instante da foto)
    drawStaticConfetti(ctx, w, h, 22);
    drawStaticGlitter(ctx, w, h, 30);

    // 3. Flores e balões
    drawCorners(ctx, w, h);

    // 4. Moldura com brasão e textos (por cima de tudo)
    drawTopFrame(ctx, w, h);
    drawBottomFrame(ctx, w, h);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Falha ao gerar imagem do canvas.'));
          }
        },
        'image/png',
        1
      );
    });
  }

  /* ------------------------------------------------------------------------
     10. CAPTURA
  ------------------------------------------------------------------------ */
  async function handleCapture() {
    if (state.isCapturing) return;
    if (!state.decorImagesReady) {
      showToast('Aguarde, preparando decoração...');
      return;
    }

    state.isCapturing = true;
    dom.btnCapture.disabled = true;

    try {
      const blob = await composeFinalImage();
      state.lastResultBlob = blob;

      // A stream só é interrompida DEPOIS de compor a imagem (o Canvas
      // precisa do último frame do vídeo). Parar aqui evita que a
      // câmera continue ligada (LED aceso, indicador de privacidade no
      // iOS, consumo de bateria) enquanto a convidada vê o resultado.
      stopStream(state.stream);
      state.stream = null;

      showResultScreen(blob);
      triggerAutoDownload(blob);
    } catch (err) {
      console.error(err);
      showToast('Não foi possível capturar a foto. Tente novamente.');
    } finally {
      state.isCapturing = false;
      dom.btnCapture.disabled = false;
    }
  }

  function showResultScreen(blob) {
    const url = URL.createObjectURL(blob);
    const previousUrl = dom.resultImage.dataset.objectUrl;

    dom.resultImage.src = url;
    dom.resultImage.dataset.objectUrl = url;

    // Libera a URL anterior para evitar vazamento de memória
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    const canShareFiles = supportsFileShare(blob);
    dom.btnShare.classList.toggle('hidden', !canShareFiles);
    dom.btnDownload.classList.remove('hidden');

    dom.stage.classList.add('hidden');
    dom.resultScreen.classList.remove('hidden');
  }

  async function hideResultScreen() {
    dom.resultScreen.classList.add('hidden');
    dom.stage.classList.remove('hidden');
    dom.btnRetake.disabled = true;

    try {
      // A stream foi parada ao entrar na tela de resultado — precisa
      // ser reiniciada aqui, ou a convidada veria uma tela preta.
      await startCamera(state.facingMode);
    } catch (err) {
      handleCameraError(err);
    } finally {
      dom.btnRetake.disabled = false;
    }
  }

  /* ------------------------------------------------------------------------
     11. DOWNLOAD
  ------------------------------------------------------------------------ */
  function triggerAutoDownload(blob) {
    try {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = CONFIG.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      // Aguarda o navegador iniciar o download antes de revogar a URL
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.warn('Download automático falhou:', err);
    }
  }

  function handleManualDownload() {
    if (!state.lastResultBlob) return;
    triggerAutoDownload(state.lastResultBlob);
    showToast('Foto baixada com sucesso.');
  }

  /* ------------------------------------------------------------------------
     12. COMPARTILHAMENTO (WEB SHARE API)
  ------------------------------------------------------------------------ */
  function supportsFileShare(blob) {
    if (!navigator.canShare || !navigator.share) return false;
    try {
      const file = new File([blob], CONFIG.fileName, { type: 'image/png' });
      return navigator.canShare({ files: [file] });
    } catch (err) {
      return false;
    }
  }

  async function handleShare() {
    if (!state.lastResultBlob) return;

    const file = new File([state.lastResultBlob], CONFIG.fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Maria Clara 15 anos',
          text: 'Celebrando meus 15 anos!'
        });
      } catch (err) {
        if (err && err.name !== 'AbortError') {
          console.warn('Falha ao compartilhar:', err);
          showToast('Não foi possível compartilhar. A foto já está salva.');
        }
      }
    } else {
      showToast('Compartilhamento não suportado. A foto já foi baixada.');
    }
  }

  /* ------------------------------------------------------------------------
     13. MODAL DE INFORMAÇÕES
  ------------------------------------------------------------------------ */
  function openInfoModal() {
    dom.infoModal.classList.remove('hidden');
  }

  function closeInfoModal() {
    dom.infoModal.classList.add('hidden');
  }

  /* ------------------------------------------------------------------------
     14. CICLO DE VIDA — economiza câmera quando a aba não está visível
  ------------------------------------------------------------------------ */
  function handleVisibilityChange() {
    if (document.hidden) {
      stopStream(state.stream);
      state.stream = null;
    } else if (!dom.stage.classList.contains('hidden')) {
      startCamera(state.facingMode).catch(handleCameraError);
    }
  }

  function handleUnload() {
    stopStream(state.stream);
  }

  /* ------------------------------------------------------------------------
     15. SERVICE WORKER (PWA)
  ------------------------------------------------------------------------ */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((err) => {
          console.warn('Falha ao registrar Service Worker:', err);
        });
      });
    }
  }

  /* ------------------------------------------------------------------------
     16. LIGAÇÃO DE EVENTOS
  ------------------------------------------------------------------------ */
  function bindEvents() {
    dom.btnRequestPermission.addEventListener('click', initCameraFlow);
    dom.btnSwitchCamera.addEventListener('click', switchCamera);
    dom.btnCapture.addEventListener('click', handleCapture);
    dom.btnInfo.addEventListener('click', openInfoModal);
    dom.btnCloseInfo.addEventListener('click', closeInfoModal);
    dom.infoBackdrop.addEventListener('click', closeInfoModal);
    dom.btnRetake.addEventListener('click', hideResultScreen);
    dom.btnShare.addEventListener('click', handleShare);
    dom.btnDownload.addEventListener('click', handleManualDownload);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    // Reajusta o frame 9:16 ao girar o aparelho ou redimensionar
    // (ex.: teclado abrindo, barra de endereço recolhendo no mobile)
    window.addEventListener('resize', scheduleFitCameraFrame);
    window.addEventListener('orientationchange', scheduleFitCameraFrame);
  }

  /* ------------------------------------------------------------------------
     17. INICIALIZAÇÃO
  ------------------------------------------------------------------------ */
  async function init() {
    bindEvents();
    registerServiceWorker();
    fitCameraFrame();
    await runLoadingSequence();
    await initCameraFlow();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
