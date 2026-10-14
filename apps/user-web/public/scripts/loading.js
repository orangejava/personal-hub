/**
 * loading 占位
 * 解决首次加载时白屏的问题
 */
(() => {
  const BOOT_LOADING_KEY = 'ph.boot.loading';
  const IMAGE_CACHE_MS = 8 * 60 * 1000;
  const readCache = () => {
    try {
      const raw = localStorage.getItem(BOOT_LOADING_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const writeCache = (config) => {
    try {
      localStorage.setItem(
        BOOT_LOADING_KEY,
        JSON.stringify({
          loadingStyle: config.loadingStyle,
          loadingTitle: config.loadingTitle,
          loadingSubtitle: config.loadingSubtitle,
          loadingImageUrl: config.loadingImageUrl,
          loadingSvg: config.loadingSvg,
          loadingShowSkeleton: config.loadingShowSkeleton !== false,
          loadingShowElapsed: config.loadingShowElapsed !== false,
          loadingMotion: config.loadingMotion,
          loadingSizeMode: config.loadingSizeMode,
          loadingMaxWidth: config.loadingMaxWidth,
          loadingMaxHeight: config.loadingMaxHeight,
          loadingWidth: config.loadingWidth,
          loadingHeight: config.loadingHeight,
          loadingVideoUrl: config.loadingVideoUrl,
          colorPrimary: config.colorPrimary || (config.theme && config.theme.colorPrimary) || '',
          savedAt: Date.now(),
        }),
      );
    } catch {
      // 写不进时下次仍会请求公开配置。
    }
  };

  const overlay = document.createElement('div');
  overlay.setAttribute('data-ph-boot', '1');
  overlay.innerHTML = `
      <style>
        html,
        body,
        #root {
          height: 100%;
          margin: 0;
          padding: 0;
        }
        #root {
          background-repeat: no-repeat;
          background-size: 100% auto;
        }

        .loading-title {
          font-size: 1.1rem;
        }

        .loading-sub-title {
          margin-top: 20px;
          font-size: 1rem;
          color: #888;
        }

        .page-loading-warp {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 26px;
        }
        .ant-spin {
          position: absolute;
          display: none;
          -webkit-box-sizing: border-box;
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          color: rgba(0, 0, 0, 0.65);
          color: #722ed1;
          font-size: 14px;
          font-variant: tabular-nums;
          line-height: 1.5;
          text-align: center;
          list-style: none;
          opacity: 0;
          -webkit-transition: -webkit-transform 0.3s
            cubic-bezier(0.78, 0.14, 0.15, 0.86);
          transition: -webkit-transform 0.3s
            cubic-bezier(0.78, 0.14, 0.15, 0.86);
          transition: transform 0.3s cubic-bezier(0.78, 0.14, 0.15, 0.86);
          transition: transform 0.3s cubic-bezier(0.78, 0.14, 0.15, 0.86),
            -webkit-transform 0.3s cubic-bezier(0.78, 0.14, 0.15, 0.86);
          -webkit-font-feature-settings: "tnum";
          font-feature-settings: "tnum";
        }

        .ant-spin-spinning {
          position: static;
          display: inline-block;
          opacity: 1;
        }

        .ant-spin-dot {
          position: relative;
          display: inline-block;
          width: 20px;
          height: 20px;
          font-size: 20px;
        }

        .ant-spin-dot-item {
          position: absolute;
          display: block;
          width: 9px;
          height: 9px;
          background-color: var(--ph-boot-color, #722ed1);
          border-radius: 100%;
          -webkit-transform: scale(0.75);
          -ms-transform: scale(0.75);
          transform: scale(0.75);
          -webkit-transform-origin: 50% 50%;
          -ms-transform-origin: 50% 50%;
          transform-origin: 50% 50%;
          opacity: 0.3;
          -webkit-animation: antspinmove 1s infinite linear alternate;
          animation: antSpinMove 1s infinite linear alternate;
        }

        .ant-spin-dot-item:nth-child(1) {
          top: 0;
          left: 0;
        }

        .ant-spin-dot-item:nth-child(2) {
          top: 0;
          right: 0;
          -webkit-animation-delay: 0.4s;
          animation-delay: 0.4s;
        }

        .ant-spin-dot-item:nth-child(3) {
          right: 0;
          bottom: 0;
          -webkit-animation-delay: 0.8s;
          animation-delay: 0.8s;
        }

        .ant-spin-dot-item:nth-child(4) {
          bottom: 0;
          left: 0;
          -webkit-animation-delay: 1.2s;
          animation-delay: 1.2s;
        }

        .ant-spin-dot-spin {
          -webkit-transform: rotate(45deg);
          -ms-transform: rotate(45deg);
          transform: rotate(45deg);
          -webkit-animation: antrotate 1.2s infinite linear;
          animation: antRotate 1.2s infinite linear;
        }

        .ant-spin-lg .ant-spin-dot {
          width: 32px;
          height: 32px;
          font-size: 32px;
        }

        .ant-spin-lg .ant-spin-dot i {
          width: 14px;
          height: 14px;
        }

        @media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {
          .ant-spin-blur {
            background: #fff;
            opacity: 0.5;
          }
        }

        @-webkit-keyframes antSpinMove {
          to {
            opacity: 1;
          }
        }

        @keyframes antSpinMove {
          to {
            opacity: 1;
          }
        }

        @-webkit-keyframes antRotate {
          to {
            -webkit-transform: rotate(405deg);
            transform: rotate(405deg);
          }
        }

        @keyframes antRotate {
          to {
            -webkit-transform: rotate(405deg);
            transform: rotate(405deg);
          }
        }

        .ph-boot-square {
          width: 36px;
          height: 36px;
          border: 3px solid #f0f0f0;
          border-top-color: var(--ph-boot-color, #722ed1);
          border-radius: 6px;
          animation: antRotate 1s linear infinite;
        }

        .ph-boot-progress {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ph-boot-progress-bar {
          width: 0;
          height: 100%;
          background: var(--ph-boot-color, #722ed1);
        }

        .ph-boot-stage {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ph-boot-stage-custom {
          width: min(var(--ph-boot-frame-width, 72px), 80vw);
          height: min(var(--ph-boot-frame-height, 72px), 70vh);
          max-width: 80vw;
          max-height: 70vh;
        }

        .ph-boot-stage-custom .ph-boot-mark,
        .ph-boot-stage-custom .ph-boot-mark svg,
        .ph-boot-stage-custom .ph-boot-mark video {
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          display: block;
        }

        .ph-boot-stage-intrinsic,
        .ph-boot-stage-intrinsic .ph-boot-mark,
        .ph-boot-stage-intrinsic .ph-boot-mark svg,
        .ph-boot-stage-intrinsic .ph-boot-mark video {
          width: auto;
          height: auto;
          max-width: min(var(--ph-boot-max-width, 320px), 80vw);
          max-height: var(--ph-boot-max-height, 320px);
          object-fit: contain;
          display: block;
        }

        @keyframes phBootSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes phBootPulse {
          50% { transform: scale(1.08); }
        }

        @keyframes phBootFloat {
          50% { transform: translateY(-10px); }
        }

        .ph-boot-motion-spin { animation: phBootSpin 2.4s linear infinite; }
        .ph-boot-motion-pulse { animation: phBootPulse 1.6s ease-in-out infinite; }
        .ph-boot-motion-float { animation: phBootFloat 2s ease-in-out infinite; }
      </style>
      <div data-ph-boot-panel="1" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 362px;
      "></div>

    `;
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:3000',
      'background:#fff',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.appendChild(overlay);
    const progress = document.createElement('div');
    progress.className = 'ph-boot-progress';
    progress.style.cssText = 'position:absolute;right:20px;bottom:16px;left:20px;display:flex;align-items:center;gap:8px;';
    const progressTrack = document.createElement('div');
    progressTrack.style.cssText = 'flex:1;height:4px;border-radius:2px;background:rgba(0,0,0,.08);overflow:hidden;';
    const progressBar = document.createElement('div');
    progressBar.className = 'ph-boot-progress-bar';
    progressBar.style.cssText = 'width:0;height:100%;background:var(--ph-boot-color,#722ed1);';
    const progressLabel = document.createElement('span');
    progressLabel.style.cssText = 'flex:none;font-size:12px;line-height:1;white-space:nowrap;text-align:right;color:var(--ph-boot-color,#722ed1);';
    progressLabel.textContent = '0%';
    progressTrack.appendChild(progressBar);
    progress.appendChild(progressTrack);
    progress.appendChild(progressLabel);
    overlay.appendChild(progress);

    const boot = overlay.querySelector('[data-ph-boot-panel]');
    const fallback = {
      loadingStyle: 'spinner',
      loadingTitle: '正在打开 Personal Hub',
      loadingSubtitle: '首次打开会先拉取页面资源，请稍候',
      loadingImageUrl: '',
      loadingSvg: '',
    };
    const cached = readCache();
    const cachedImageFresh =
      cached &&
      typeof cached.savedAt === 'number' &&
      Date.now() - cached.savedAt < IMAGE_CACHE_MS;

    const escapeText = (value) =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const safeSvg = (value) => {
      const text = String(value || '').trim();
      const allowed = {
        svg: 1, g: 1, path: 1, circle: 1, rect: 1, ellipse: 1, line: 1,
        polyline: 1, polygon: 1, text: 1, tspan: 1, defs: 1,
        lineargradient: 1, radialgradient: 1, stop: 1, title: 1, desc: 1,
        clippath: 1, mask: 1,
      };
      if (!/^<svg[\s>]/i.test(text) || !/<\/svg>\s*$/i.test(text)) return '';
      if (/<\s*(script|foreignobject|iframe|embed|object|image|use|set|animate|animatetransform|animatemotion|style|link|meta|audio|video|canvas)\b/i.test(text)) {
        return '';
      }
      if (/javascript\s*:|\son[a-z0-9_-]+\s*=|(?:xlink:)?href\s*=/i.test(text)) return '';
      const tags = text.match(/<\/?\s*([a-zA-Z][\w:-]*)/g) || [];
      for (let index = 0; index < tags.length; index += 1) {
        const name = tags[index].replace(/<\/?\s*/, '').toLowerCase();
        if (!allowed[name]) return '';
      }
      return text;
    };

    const safeImageUrl = (value) => {
      const text = String(value || '').trim();
      if (text.startsWith('/') || text.startsWith('https://') || text.startsWith('http://')) {
        return text;
      }
      return '';
    };

    const dots = `<div class="ant-spin ant-spin-lg ant-spin-spinning"><span class="ant-spin-dot ant-spin-dot-spin"><i class="ant-spin-dot-item"></i><i class="ant-spin-dot-item"></i><i class="ant-spin-dot-item"></i><i class="ant-spin-dot-item"></i></span></div>`;
    let paintKey = '';

    const readLimit = (value) => {
      const size = Number(value);
      if (!Number.isFinite(size)) return 320;
      return Math.min(480, Math.max(48, Math.round(size)));
    };

    const readSide = (value, limit) => {
      const size = Number(value);
      const side = Number.isFinite(size) ? Math.round(size) : 72;
      return Math.min(limit, Math.max(48, side));
    };

    const readMotion = (value) =>
      value === 'spin' || value === 'pulse' || value === 'float' ? value : 'none';

    const paint = (config, allowDots) => {
      if (!boot || !boot.isConnected) return 'spinner';
      const style = config.loadingStyle || 'spinner';
      const title = escapeText(config.loadingTitle || fallback.loadingTitle);
      const subtitle = escapeText(config.loadingSubtitle || fallback.loadingSubtitle);
      const showSkeleton = config.loadingShowSkeleton !== false;
      const motion = readMotion(config.loadingMotion);
      const customSize = config.loadingSizeMode === 'custom';
      const maxWidth = readLimit(config.loadingMaxWidth);
      const maxHeight = readLimit(config.loadingMaxHeight);
      const frameWidth = readSide(config.loadingWidth, maxWidth);
      const frameHeight = readSide(config.loadingHeight, maxHeight);
      const imageUrl = style === 'image' ? safeImageUrl(config.loadingImageUrl) : '';
      const videoUrl = style === 'video' ? safeImageUrl(config.loadingVideoUrl) : '';
      const visual = style === 'image' || style === 'svg' || style === 'video';
      const nextKey = [
        style,
        title,
        subtitle,
        imageUrl,
        videoUrl,
        showSkeleton,
        motion,
        customSize ? 'custom' : 'default',
        maxWidth,
        maxHeight,
        frameWidth,
        frameHeight,
      ].join('\n');
      if (nextKey === paintKey) return style;
      paintKey = nextKey;
      const motionClass = visual && motion !== 'none' ? ` ph-boot-motion-${motion}` : '';
      const frameClass = visual ? (customSize ? ' ph-boot-stage-custom' : ' ph-boot-stage-intrinsic') : '';
      const stageStyle = !visual
        ? ''
        : customSize
          ? ` style="--ph-boot-frame-width:${frameWidth}px;--ph-boot-frame-height:${frameHeight}px"`
          : ` style="--ph-boot-max-width:${maxWidth}px;--ph-boot-max-height:${maxHeight}px"`;
      let inner = '';
      if (style === 'square') {
        inner = '<div class="ph-boot-square"></div>';
      } else if (style === 'image') {
        inner = imageUrl
          ? `<div class="ph-boot-mark" data-ph-boot-image="${escapeText(imageUrl)}"></div>`
          : '<div class="ph-boot-mark"></div>';
      } else if (style === 'video') {
        inner = videoUrl
          ? `<div class="ph-boot-mark" data-ph-boot-video="${escapeText(videoUrl)}"></div>`
          : '<div class="ph-boot-mark"></div>';
      } else if (style === 'svg' && safeSvg(config.loadingSvg)) {
        inner = `<div class="ph-boot-mark">${safeSvg(config.loadingSvg)}</div>`;
      } else if (style === 'svg') {
        inner = '<div class="ph-boot-mark"></div>';
      } else if (allowDots) {
        inner = dots;
      }
      const mark = `<div class="ph-boot-stage${frameClass}${motionClass}"${stageStyle}>${inner}</div>`;
      const bars = showSkeleton
        ? `<div style="width:min(420px,80vw);margin-top:28px">
          <div style="height:16px;border-radius:8px;background:#f0f0f0;margin-bottom:12px"></div>
          <div style="height:12px;border-radius:8px;background:#f5f5f5;margin-bottom:8px"></div>
          <div style="height:12px;width:70%;border-radius:8px;background:#f5f5f5"></div>
        </div>`
        : '';
      boot.innerHTML = `
        <div class="page-loading-warp">${mark}</div>
        <div class="loading-title">${title}</div>
        <div class="loading-sub-title">${subtitle}</div>
        ${bars}
      `;
      if (imageUrl || videoUrl) {
        window.setTimeout(() => {
          const imageHolder = boot.querySelector('[data-ph-boot-image]');
          if (imageHolder) {
            const img = document.createElement('img');
            img.className = 'ph-boot-mark';
            img.alt = '';
            img.decoding = 'async';
            img.fetchPriority = 'low';
            img.src = imageHolder.getAttribute('data-ph-boot-image') || '';
            imageHolder.replaceWith(img);
          }
          const videoHolder = boot.querySelector('[data-ph-boot-video]');
          if (videoHolder) {
            const video = document.createElement('video');
            video.className = 'ph-boot-mark';
            video.muted = true;
            video.loop = true;
            video.autoplay = true;
            video.playsInline = true;
            video.src = videoHolder.getAttribute('data-ph-boot-video') || '';
            videoHolder.replaceWith(video);
          }
        }, 0);
      }
      return style;
    };

    const safeColor = (value) => (/^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? value : '#722ed1');
    const applyColor = (value) => {
      overlay.style.setProperty('--ph-boot-color', safeColor(value));
    };

    let paintedStyle = '';
    let removed = false;
    const initial = cached
      ? {
          ...cached,
          loadingImageUrl: cachedImageFresh ? cached.loadingImageUrl : '',
          loadingVideoUrl: cachedImageFresh ? cached.loadingVideoUrl : '',
        }
      : null;
    if (initial && initial.loadingStyle) {
      paintedStyle = paint(initial, true);
      applyColor(initial.colorPrimary);
    } else {
      paintedStyle = paint(fallback, true);
      applyColor('#722ed1');
    }

    const appReady = () => {
      const root = document.getElementById('root');
      return !!(root && root.querySelector('.ph-public-layout, .ant-pro-layout, .ant-app'));
    };

    const STAGES = [8, 18, 46, 88, 100];
    // 文件还没到下一档时慢走，避免进度停住，也不提前标成这一档已完成。
    const WAITING_SPEED = 8;
    // 这一档已经测到时仍要从当前百分比走到档位终点，再进下一档。约 0.8 秒走完全程，不能一帧跳过。
    const DONE_SPEED = 120;
    const bootStarted = performance.now();
    let shown = 0;
    let showElapsed = !cached || cached.loadingShowElapsed !== false;
    let lastTick = performance.now();
    const measure = () => {
      const resources = performance.getEntriesByType('resource');
      const mainLoaded = resources.some(
        (entry) => entry.responseEnd > 0 && /\/umi(\.js)?(\?|$)/.test(entry.name),
      );
      const ready = appReady();
      if (ready && document.readyState === 'complete') return 100;
      if (ready) return 88;
      if (mainLoaded) return 46;
      if (document.readyState !== 'loading') return 18;
      return 8;
    };
    const nextStage = (value) => {
      for (let index = 0; index < STAGES.length; index += 1) {
        if (STAGES[index] > value + 0.05) return STAGES[index];
      }
      return 100;
    };
    const stepToward = (goal, dt, speed) => {
      const delta = goal - shown;
      if (Math.abs(delta) < 0.05) {
        shown = goal;
        return;
      }
      shown += Math.sign(delta) * Math.min(Math.abs(delta), speed * dt);
    };
    const paintLabel = (width, now) => {
      const percent = `${Math.round(width)}%`;
      if (!showElapsed) {
        progressLabel.textContent = percent;
        return;
      }
      const seconds = Math.max(0, (now - bootStarted) / 1000);
      progressLabel.textContent = `${percent} - ${seconds.toFixed(1)}s`;
    };
    const frame = (now) => {
      if (removed || !progressBar) return;
      const dt = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
      lastTick = now;
      const measured = measure();
      if (shown < 100) {
        const end = nextStage(shown);
        if (measured + 0.05 >= end) {
          stepToward(end, dt, DONE_SPEED);
        } else {
          const creepCap = end - 0.6;
          if (shown < creepCap) stepToward(creepCap, dt, WAITING_SPEED);
        }
      }
      const width = Math.max(0, Math.min(100, shown));
      progressBar.style.width = `${width}%`;
      paintLabel(width, now);
      if (shown >= 100 && measured === 100) {
        removed = true;
        overlay.remove();
        document.documentElement.style.overflow = '';
        return;
      }
      window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(frame);

    fetch('/api/v1/public/site-config')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const config = body && body.data ? body.data : body;
        if (!config || typeof config !== 'object') return;
        writeCache(config);
        showElapsed = config.loadingShowElapsed !== false;
        paintedStyle = paint(config, true);
        applyColor(config.theme && config.theme.colorPrimary);
      })
      .catch(() => undefined);
})();
