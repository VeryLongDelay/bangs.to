import { defineConfig, presetUno } from 'unocss';

export default defineConfig({
  presets: [presetUno()],
  content: {
    filesystem: ['src/**/*.{astro,html,ts}']
  },
  theme: {
    colors: {
      text: {
        DEFAULT: '#16324f',
        secondary: '#58708c',
        muted: '#7890aa',
        hover: '#0f2740'
      },
      bg: {
        DEFAULT: '#f4f8fc',
        secondary: 'rgba(255, 255, 255, 0.76)',
        hover: '#ffffff',
        active: '#e6eef8',
        soft: '#edf4fb',
        strong: '#dce8f5'
      },
      border: '#c5d5e6',
      danger: '#dc4f5f',
      success: '#1d8f6d',
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        300: '#93c5fd',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8'
      },
      accent: '#0f766e',
      chrome: {
        1: '#7ba6d8',
        2: '#4d82c3',
        3: '#16324f',
        highlight: 'rgba(59, 130, 246, 0.16)'
      },
      glow: 'rgba(37, 99, 235, 0.12)'
    },
    fontFamily: {
      sans: [
        '"Work Sans"',
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'sans-serif'
      ],
      display: ['"Outfit"', '"Work Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: [
        'ui-monospace',
        'SFMono-Regular',
        'Menlo',
        'Monaco',
        'Consolas',
        '"Liberation Mono"',
        '"Courier New"',
        'monospace'
      ]
    }
  },
  safelist: [
    'opacity-100',
    'visible',
    'translate-y-0',
    'sm:grid-cols-2',
    'lg:grid-cols-2',
    'lg:col-span-2',
    'md:grid-cols-3'
  ],
  preflights: [
    {
      getCSS: ({ theme }) => `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Work+Sans:wght@400;500;600;700&display=swap');

        :root {
          color-scheme: light;
          font-family: ${theme.fontFamily.sans};
          font-synthesis: none;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        :root[data-theme="dark"] {
          color-scheme: dark;
        }

        html {
          min-height: 100%;
          background: ${theme.colors.bg.DEFAULT};
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: ${theme.colors.border} transparent;
        }

        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        *::-webkit-scrollbar-track {
          background: transparent;
        }

        *::-webkit-scrollbar-thumb {
          background-color: ${theme.colors.border};
          border-radius: 999px;
        }

        *::-webkit-scrollbar-thumb:hover {
          background-color: ${theme.colors.text.secondary};
        }

        *:focus-visible {
          outline: 3px solid rgba(37, 99, 235, 0.24);
          outline-offset: 2px;
        }

        body {
          min-height: 100vh;
          line-height: 1.5;
          font-size: 16px;
          color: ${theme.colors.text.DEFAULT};
          background:
            radial-gradient(circle at top left, rgba(191, 219, 254, 0.9), transparent 34%),
            radial-gradient(circle at top right, rgba(186, 230, 253, 0.72), transparent 30%),
            linear-gradient(180deg, #f8fbff 0%, ${theme.colors.bg.DEFAULT} 48%, #eff5fb 100%);
          overflow-x: hidden;
        }

        body::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.4) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.4), transparent 78%);
          opacity: 0.45;
        }

        :root[data-theme="dark"] html {
          background: #08111d;
        }

        :root[data-theme="dark"] body {
          color: #e5eef9;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.18), transparent 34%),
            radial-gradient(circle at top right, rgba(14, 165, 233, 0.14), transparent 30%),
            linear-gradient(180deg, #08111d 0%, #091625 48%, #0b1828 100%);
        }

        :root[data-theme="dark"] body::before {
          background-image:
            linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
          opacity: 0.55;
        }

        :root[data-theme="dark"] * {
          scrollbar-color: rgba(96, 165, 250, 0.26) transparent;
        }

        :root[data-theme="dark"] *::-webkit-scrollbar-thumb {
          background-color: rgba(96, 165, 250, 0.26);
        }

        :root[data-theme="dark"] *::-webkit-scrollbar-thumb:hover {
          background-color: rgba(147, 197, 253, 0.38);
        }

        :root[data-theme="dark"] *:focus-visible {
          outline: 3px solid rgba(96, 165, 250, 0.34);
        }
      `
    },
    {
      getCSS: ({ theme }) => `
        input,
        select {
          width: 100%;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid ${theme.colors.border};
          color: ${theme.colors.text.DEFAULT};
          font: inherit;
          box-shadow:
            0 1px 2px rgba(15, 39, 64, 0.05),
            0 0 0 1px rgba(255, 255, 255, 0.6) inset;
        }

        input::placeholder {
          color: ${theme.colors.text.muted};
          opacity: 1;
        }

        input:focus,
        select:focus {
          outline: none;
          border-color: ${theme.colors.primary[500]};
          box-shadow:
            0 0 0 4px rgba(59, 130, 246, 0.14),
            0 6px 18px rgba(37, 99, 235, 0.08);
        }

        select {
          padding-right: 2.75rem;
          -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%234d82c3' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat !important;
          background-position: right 0.9rem center;
          background-size: 1rem 1rem;
          background-origin: content-box;
        }

        select option {
          background: ${theme.colors.bg.hover};
          color: ${theme.colors.text.DEFAULT};
        }

        a {
          color: ${theme.colors.primary[700]};
          transition:
            color 0.18s ease,
            opacity 0.18s ease,
            transform 0.18s ease;
        }

        a:hover {
          color: ${theme.colors.text.hover};
        }

        code {
          font-family: ${theme.fontFamily.mono};
          font-size: 0.92em;
          color: ${theme.colors.text.DEFAULT};
          background: rgba(219, 234, 254, 0.55);
          padding: 0.15rem 0.38rem;
          border-radius: 0.45rem;
        }

        strong {
          color: ${theme.colors.text.hover};
        }

        .switch {
          font-size: 17px;
          position: relative;
          display: inline-block;
          width: 4em;
          height: 2.2em;
          border-radius: 30px;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(15, 39, 64, 0.1);
        }

        .theme-switch-input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
        }

        .slider {
          position: absolute;
          inset: 0;
          cursor: pointer;
          background-color: #00a6ff;
          transition: 0.4s;
          border-radius: 30px;
          overflow: hidden;
        }

        .slider::before {
          position: absolute;
          content: "";
          height: 1.2em;
          width: 1.2em;
          border-radius: 20px;
          left: 0.5em;
          bottom: 0.5em;
          transition: 0.4s;
          transition-timing-function: cubic-bezier(0.81, -0.04, 0.38, 1.5);
          box-shadow: inset 15px -4px 0 15px #ffcf48;
          background: transparent;
        }

        .theme-switch-input:checked + .slider {
          background-color: #2a2a2a;
        }

        .theme-switch-input:checked + .slider::before {
          transform: translateX(1.8em);
          box-shadow: inset 8px -4px 0 0 #fff;
        }

        .sun {
          background-color: rgba(255, 255, 255, 0.92);
          border-radius: 50%;
          position: absolute;
          width: 5px;
          height: 5px;
          transition: all 0.4s;
        }

        .sun_1 {
          left: 2.5em;
          top: 0.5em;
        }

        .sun_2 {
          left: 2.2em;
          top: 1.2em;
        }

        .sun_3 {
          left: 3em;
          top: 0.9em;
        }

        .theme-switch-input:checked + .slider .sun {
          opacity: 0;
        }

        .cloud {
          width: 3.5em;
          position: absolute;
          bottom: -1.4em;
          left: -1.1em;
          opacity: 1;
          transition: all 0.4s;
          color: #fff;
        }

        .theme-switch-input:checked + .slider .cloud {
          opacity: 0;
        }

        .wordmark {
          position: relative;
          display: inline-block;
        }

        #metal-canvas {
          position: absolute;
          inset: 0;
        }

        .wordmark-text {
          font-family: ${theme.fontFamily.display};
          font-size: clamp(3.6rem, 14vw, 6.8rem);
          font-weight: 800;
          letter-spacing: -0.05em;
          line-height: 0.85;
          color: ${theme.colors.chrome[3]};
          visibility: hidden;
        }

        .wordmark.ready .wordmark-text {
          visibility: visible;
        }

        .wordmark.has-shader .wordmark-text {
          visibility: hidden;
        }

        .btn {
          background: rgba(255, 255, 255, 0.84);
          color: ${theme.colors.text.DEFAULT};
          border: 1px solid rgba(123, 166, 216, 0.28);
          box-shadow:
            0 12px 30px rgba(15, 39, 64, 0.07),
            0 1px 0 rgba(255, 255, 255, 0.75) inset;
        }

        .btn:hover {
          background: rgba(255, 255, 255, 0.98);
          transform: translateY(-1px);
          box-shadow:
            0 16px 34px rgba(15, 39, 64, 0.1),
            0 1px 0 rgba(255, 255, 255, 0.88) inset;
        }

        .btn:active {
          transform: translateY(0);
          background: ${theme.colors.bg.active};
          box-shadow:
            0 6px 18px rgba(15, 39, 64, 0.09),
            0 1px 0 rgba(255, 255, 255, 0.8) inset;
        }

        .btn-primary {
          background: linear-gradient(135deg, ${theme.colors.primary[600]}, ${theme.colors.accent});
          color: #fff;
          box-shadow:
            0 18px 36px rgba(37, 99, 235, 0.24),
            0 1px 0 rgba(255, 255, 255, 0.14) inset;
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow:
            0 22px 40px rgba(37, 99, 235, 0.28),
            0 1px 0 rgba(255, 255, 255, 0.18) inset;
          filter: saturate(1.06);
        }

        .btn-primary:active {
          transform: translateY(0);
          box-shadow:
            0 10px 20px rgba(37, 99, 235, 0.18),
            0 1px 0 rgba(255, 255, 255, 0.12) inset;
        }

        .btn-danger {
          background: linear-gradient(135deg, #ef6b77, #d94757);
          color: #fff;
          box-shadow: 0 14px 26px rgba(220, 79, 95, 0.18);
        }

        .btn-danger:hover {
          transform: translateY(-1px);
          filter: saturate(1.04);
        }

        .btn-danger:active {
          transform: translateY(0);
        }

        :root[data-theme="dark"] input,
        :root[data-theme="dark"] select {
          background: rgba(8, 17, 29, 0.88);
          border-color: rgba(96, 165, 250, 0.2);
          color: #eff6ff;
          box-shadow:
            0 1px 2px rgba(2, 6, 23, 0.45),
            0 0 0 1px rgba(96, 165, 250, 0.06) inset;
        }

        :root[data-theme="dark"] input::placeholder {
          color: #8fa7c1;
        }

        :root[data-theme="dark"] input:focus,
        :root[data-theme="dark"] select:focus {
          border-color: #60a5fa;
          box-shadow:
            0 0 0 4px rgba(96, 165, 250, 0.16),
            0 12px 28px rgba(2, 6, 23, 0.35);
        }

        :root[data-theme="dark"] select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%2393c5fd' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat !important;
          background-position: right 0.9rem center;
          background-size: 1rem 1rem;
        }

        :root[data-theme="dark"] select option {
          background: #08111d;
          color: #eff6ff;
        }

        :root[data-theme="dark"] a {
          color: #93c5fd;
        }

        :root[data-theme="dark"] a:hover {
          color: #dbeafe;
        }

        :root[data-theme="dark"] code {
          color: #eff6ff;
          background: rgba(37, 99, 235, 0.18);
        }

        :root[data-theme="dark"] strong {
          color: #f8fbff;
        }

        :root[data-theme="dark"] .card {
          background: rgba(8, 17, 29, 0.72);
          border-color: rgba(148, 163, 184, 0.14);
          box-shadow: 0 26px 52px rgba(2, 6, 23, 0.28);
        }

        :root[data-theme="dark"] .btn {
          background: rgba(15, 23, 42, 0.74);
          color: #e5eef9;
          border-color: rgba(96, 165, 250, 0.16);
          box-shadow:
            0 18px 32px rgba(2, 6, 23, 0.28),
            0 1px 0 rgba(191, 219, 254, 0.06) inset;
        }

        :root[data-theme="dark"] .btn:hover {
          background: rgba(20, 31, 52, 0.94);
          box-shadow:
            0 18px 36px rgba(2, 6, 23, 0.34),
            0 1px 0 rgba(191, 219, 254, 0.08) inset;
        }

        :root[data-theme="dark"] .btn:active {
          background: rgba(12, 21, 36, 0.96);
        }

        :root[data-theme="dark"] .btn-primary {
          box-shadow:
            0 18px 36px rgba(29, 78, 216, 0.34),
            0 1px 0 rgba(255, 255, 255, 0.08) inset;
        }

        .switch:focus-within {
          outline: 3px solid rgba(59, 130, 246, 0.24);
          outline-offset: 3px;
        }

        :root[data-theme="dark"] .switch {
          box-shadow: 0 0 12px rgba(2, 6, 23, 0.32);
        }

        :root[data-theme="dark"] .text-text {
          color: #e5eef9 !important;
        }

        :root[data-theme="dark"] .section-title {
          color: #f8fbff !important;
        }

        :root[data-theme="dark"] .text-text-secondary {
          color: #94a9c3 !important;
        }

        :root[data-theme="dark"] .text-text-muted {
          color: #7d94b1 !important;
        }

        :root[data-theme="dark"] .bg-bg-soft {
          background: rgba(15, 23, 42, 0.78) !important;
        }

        :root[data-theme="dark"] .bg-bg-strong {
          background: rgba(30, 41, 59, 0.9) !important;
        }

        :root[data-theme="dark"] .bg-primary-50\\/70,
        :root[data-theme="dark"] .bg-primary-50\\/75 {
          background: rgba(30, 64, 175, 0.18) !important;
        }

        :root[data-theme="dark"] [class*="bg-white/80"],
        :root[data-theme="dark"] [class*="bg-white/85"],
        :root[data-theme="dark"] [class*="bg-white/86"],
        :root[data-theme="dark"] [class*="bg-white/88"],
        :root[data-theme="dark"] [class*="bg-white/90"] {
          background: rgba(15, 23, 42, 0.82) !important;
        }

        :root[data-theme="dark"] [class*="border-white/70"],
        :root[data-theme="dark"] [class*="border-white/80"],
        :root[data-theme="dark"] [class*="border-white/85"] {
          border-color: rgba(148, 163, 184, 0.14) !important;
        }

        :root[data-theme="dark"] #settings-modal {
          background: rgba(2, 6, 23, 0.72) !important;
        }

        :root[data-theme="dark"] #settings-modal .modal-card {
          background: rgba(8, 17, 29, 0.96) !important;
          border-color: rgba(148, 163, 184, 0.16) !important;
          box-shadow: 0 30px 90px rgba(2, 6, 23, 0.48) !important;
        }

        :root[data-theme="dark"] #settings-modal .section-title,
        :root[data-theme="dark"] #settings-modal h2,
        :root[data-theme="dark"] #settings-modal strong {
          color: #f8fbff !important;
        }

        :root[data-theme="dark"] #settings-modal .label-text,
        :root[data-theme="dark"] #settings-modal .text-text-secondary,
        :root[data-theme="dark"] #settings-modal #bang-status,
        :root[data-theme="dark"] #settings-modal #bang-count {
          color: #bfd1e6 !important;
        }

        :root[data-theme="dark"] #settings-modal .text-text-muted {
          color: #8fa7c1 !important;
        }

        :root[data-theme="dark"] #settings-modal .bg-bg-soft {
          background: rgba(23, 37, 63, 0.92) !important;
        }
      `
    },
    {
      getCSS: ({ theme }) => `
        @keyframes flash {
          0%, 100% { background-color: rgba(255, 255, 255, 0.92); }
          50% { background-color: ${theme.colors.bg.strong}; }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        @keyframes flash-burst {
          0% { filter: brightness(1); }
          50% { filter: brightness(1.4); }
          100% { filter: brightness(1); }
        }

        .flash-anim {
          animation: flash 0.3s ease-out;
        }

        .shake-anim {
          animation: shake 0.2s ease-in-out;
        }

        .flash-burst {
          animation: flash-burst 0.6s ease-out;
        }

        #gear-btn {
          transition:
            color 0.15s,
            background-color 0.15s,
            border-color 0.15s ease;
        }

        #settings-modal {
          transition: opacity 0.2s ease, visibility 0.2s;
          backdrop-filter: blur(12px);
        }

        #settings-modal .modal-card {
          transition: transform 0.2s ease;
        }

        #settings-modal.open .modal-card {
          transform: translateY(0);
        }

        @media (prefers-reduced-motion: reduce) {
          .flash-anim,
          .shake-anim,
          .flash-burst {
            animation: none;
          }

          .btn,
          .btn-primary,
          .btn-danger,
          a,
          #gear-btn {
            transition: none;
          }

          #settings-modal,
          #settings-modal .modal-card {
            transition: none;
          }
        }
      `
    }
  ],
  shortcuts: {
    'card':
      'rounded-[24px] border border-white/70 bg-bg-secondary p-5 shadow-[0_22px_50px_rgba(15,39,64,0.08)] backdrop-blur-xl sm:p-6',
    'btn':
      'px-4 py-2.5 rounded-2xl text-sm font-600 transition-all duration-200 cursor-pointer border-none',
    'btn-primary':
      'px-4 py-2.5 rounded-2xl text-sm font-600 transition-all duration-200 cursor-pointer border-none',
    'btn-danger':
      'text-xs px-2.5 py-1.5 rounded-xl font-600 transition-all duration-200 cursor-pointer border-none',
    'input-field': 'w-full px-4 py-3 rounded-2xl text-text text-sm transition-all duration-150',
    'label-text': 'text-sm text-text-secondary leading-relaxed',
    'section-title': 'text-[1.05rem] font-700 tracking-tight text-text font-display'
  }
});
