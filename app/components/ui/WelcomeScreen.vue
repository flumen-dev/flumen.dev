<script setup lang="ts">
const { locale } = useI18n()

useHead({
  htmlAttrs: { lang: locale },
  title: 'Flumen',
})
</script>

<template>
  <div>
    <!-- Hero -->
    <div class="min-h-dvh flex flex-col items-center justify-center px-6 relative">
      <!-- Animated Logo -->
      <svg
        class="text-primary w-40 sm:w-48"
        viewBox="18 82 220 94"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <g
          transform="translate(0.000000,256.000000) scale(0.100000,-0.100000)"
          fill="currentColor"
          stroke="none"
        >
          <path
            class="wave wave-1"
            d="M677 1304 c93 -34 313 -183 313 -211 0 -17 -124 -102 -219 -150 -184 -93 -343 -93 -439 0 -50 48 -72 97 -72 162 0 90 39 150 128 195 90 45 178 46 289 4z"
          />
          <path
            class="wave wave-2"
            d="M1202 1636 c87 -29 348 -169 348 -186 0 -6 -107 -102 -128 -114 -8 -5 -53 19 -122 64 -124 81 -249 141 -330 161 -73 17 -191 16 -265 -4 -32 -9 -61 -14 -63 -12 -13 13 173 98 253 115 73 16 223 5 307 -24z"
          />
          <path
            class="wave wave-3"
            d="M906 1515 c98 -23 163 -57 352 -182 302 -200 457 -265 632 -265 65 0 101 6 155 26 38 14 71 24 72 22 2 -1 -23 -29 -54 -61 -140 -144 -321 -211 -496 -184 -137 21 -220 65 -467 250 -88 66 -194 140 -234 164 -146 89 -272 119 -376 91 -30 -8 -56 -13 -58 -11 -5 4 99 85 143 111 88 51 216 66 331 39z"
          />
          <path
            class="wave wave-4"
            fill-rule="evenodd"
            d="M2139 1654 c63 -18 132 -82 151 -138 19 -58 9 -163 -21 -222 -29 -56 -100 -115 -169 -140 -25 -9 -92 -18 -151 -21 -86 -4 -121 -2 -190 16 -82 20 -289 113 -289 130 0 5 66 73 148 152 155 151 218 195 323 223 71 19 134 19 198 0z M1772 1390 c-56 -20 -113 -52 -130 -73 -7 -8 24 -4 89 12 91 22 107 24 167 13 74 -12 109 -34 133 -80 l17 -32 6 35 c22 115 -127 181 -282 125z"
          />
        </g>
      </svg>

      <!-- Text -->
      <div class="text-center -mt-1">
        <p class="anim anim-greeting text-sm tracking-widest uppercase text-muted">
          {{ $t('welcome.greeting') }}
        </p>
        <h1 class="anim anim-title text-5xl sm:text-6xl font-bold tracking-tight text-primary">
          {{ $t('common.title') }}
        </h1>
      </div>

      <p class="anim anim-desc text-base sm:text-lg text-muted text-center max-w-sm mt-3">
        {{ $t('common.description') }}
      </p>

      <UButton
        class="anim anim-cta mt-8"
        icon="i-lucide-github"
        :label="$t('auth.loginWithGithub')"
        to="/auth/github"
        external
        size="lg"
      />

      <!-- Issue #13 - This is NOT finished and not translated at all! -->
      <!-- Scroll indicator -->
      <button
        class="anim anim-scroll absolute bottom-8 flex flex-col items-center gap-1 text-muted hover:text-default transition-colors cursor-pointer"
        aria-label="Scroll down"
        @click="$el.closest('.min-h-dvh')?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })"
      >
        <span class="text-xs tracking-wide">Discover more</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-5 bounce"
        />
      </button>
    </div>

    <!-- Content sections (placeholder — see issue #13) -->
    <section class="py-24 px-6">
      <div class="mx-auto max-w-4xl space-y-32">
        <!-- Feature 1 -->
        <div class="flex flex-col md:flex-row items-center gap-12">
          <div class="flex-1 space-y-4">
            <h2 class="text-3xl font-bold">
              Your dashboard, your flow
            </h2>
            <p class="text-lg text-muted">
              Everything you care about — issues, pull requests, notifications — in one clean overview. No clutter, no noise.
            </p>
          </div>
          <div class="flex-1 rounded-xl border border-default bg-muted/50 aspect-video flex items-center justify-center">
            <span class="text-muted text-sm">Screenshot placeholder</span>
          </div>
        </div>

        <!-- Feature 2 -->
        <div class="flex flex-col md:flex-row-reverse items-center gap-12">
          <div class="flex-1 space-y-4">
            <h2 class="text-3xl font-bold">
              Issues & Pull Requests
            </h2>
            <p class="text-lg text-muted">
              Browse, filter, and manage across all your repositories. Fast search, keyboard shortcuts, zero friction.
            </p>
          </div>
          <div class="flex-1 rounded-xl border border-default bg-muted/50 aspect-video flex items-center justify-center">
            <span class="text-muted text-sm">Screenshot placeholder</span>
          </div>
        </div>

        <!-- Feature 3 -->
        <div class="flex flex-col md:flex-row items-center gap-12">
          <div class="flex-1 space-y-4">
            <h2 class="text-3xl font-bold">
              Notifications that make sense
            </h2>
            <p class="text-lg text-muted">
              Smart grouping, instant updates, and a clean inbox. Stay on top of what matters without drowning in noise.
            </p>
          </div>
          <div class="flex-1 rounded-xl border border-default bg-muted/50 aspect-video flex items-center justify-center">
            <span class="text-muted text-sm">Screenshot placeholder</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="py-24 px-6 text-center">
      <h2 class="text-3xl font-bold mb-4">
        Ready to flow?
      </h2>
      <p class="text-lg text-muted mb-8">
        Connect your GitHub and get started in seconds.
      </p>
      <UButton
        icon="i-lucide-github"
        :label="$t('auth.loginWithGithub')"
        to="/auth/github"
        external
        size="xl"
      />
    </section>
  </div>
</template>

<style scoped>
/* Wave entrance — each path flows in from left, staggered */
.wave {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: left center;
  will-change: opacity, transform, filter;
  animation: wave-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.wave-1 { --end-opacity: 0.4; animation-delay: 0.2s; }
.wave-2 { --end-opacity: 0.7; animation-delay: 0.4s; }
.wave-3 { --end-opacity: 0.7; animation-delay: 0.6s; }
.wave-4 { --end-opacity: 1;   animation-delay: 0.8s; }

@keyframes wave-in {
  0% {
    opacity: 0;
    transform: translateX(-25%) scale(0.6);
    filter: blur(6px);
  }
  100% {
    opacity: var(--end-opacity);
    transform: translateX(0) scale(1);
    filter: blur(0);
  }
}

/* Text & button fade up */
.anim {
  opacity: 0;
  will-change: opacity, transform, filter;
}

.anim-greeting { animation: fade-up 0.6s ease-out 1.3s forwards; }
.anim-title    { animation: fade-up 0.7s ease-out 1.5s forwards; }
.anim-desc     { animation: fade-up 0.6s ease-out 1.9s forwards; }
.anim-cta      { animation: fade-up 0.5s ease-out 2.3s forwards; }
.anim-scroll   { animation: fade-up 0.5s ease-out 2.7s forwards; }

@keyframes fade-up {
  0% {
    opacity: 0;
    transform: translateY(16px);
    filter: blur(4px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

/* Bouncing arrow */
.bounce {
  animation: bounce 2s ease-in-out 3.2s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wave,
  .anim {
    animation: none !important;
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
  }
  .wave-1 { opacity: 0.4 !important; }
  .wave-2 { opacity: 0.7 !important; }
  .wave-3 { opacity: 0.7 !important; }
  .wave-4 { opacity: 1 !important; }
  .bounce { animation: none !important; }
}
</style>
