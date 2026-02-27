<script setup lang="ts">
const { locale } = useI18n()

useHead({
  htmlAttrs: { lang: locale },
  title: 'Flumen',
})

// Scroll reveal with IntersectionObserver
const sectionsRef = useTemplateRef<HTMLElement>('sections')

onMounted(() => {
  const el = sectionsRef.value
  if (!el) return

  const targets = el.querySelectorAll('.reveal')
  if (!targets.length) return

  // Hide initially via JS so content stays visible if JS fails
  for (const target of targets) {
    target.classList.add('reveal-hidden')
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-hidden')
          observer.unobserve(entry.target)
        }
      }
    },
    { threshold: 0.15 },
  )

  for (const target of targets) {
    observer.observe(target)
  }
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

      <!-- Scroll indicator -->
      <button
        class="anim anim-scroll absolute bottom-8 flex flex-col items-center gap-1 text-muted hover:text-default transition-colors cursor-pointer"
        :aria-label="$t('welcome.scrollDiscover')"
        @click="(e: MouseEvent) => (e.currentTarget as HTMLElement)?.closest('.min-h-dvh')?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })"
      >
        <span class="text-xs tracking-wide">{{ $t('welcome.scrollDiscover') }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-5 bounce"
        />
      </button>
    </div>

    <!-- Main content -->
    <div ref="sections">
      <!-- Trust Bar -->
      <div class="py-6 border-y border-default">
        <div class="mx-auto max-w-4xl px-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted">
          <span class="flex items-center gap-2">
            <UIcon
              name="i-lucide-code-2"
              class="size-4 text-primary"
            />
            {{ $t('welcome.trust.openSource') }}
          </span>
          <span class="flex items-center gap-2">
            <UIcon
              name="i-lucide-shield-check"
              class="size-4 text-primary"
            />
            {{ $t('welcome.trust.githubOauth') }}
          </span>
          <span class="flex items-center gap-2">
            <UIcon
              name="i-lucide-eye-off"
              class="size-4 text-primary"
            />
            {{ $t('welcome.trust.noTracking') }}
          </span>
          <span class="flex items-center gap-2">
            <UIcon
              name="i-lucide-heart"
              class="size-4 text-primary"
            />
            {{ $t('welcome.trust.freePlan') }}
          </span>
        </div>
      </div>

      <!-- Feature Sections -->
      <section class="py-24 px-6">
        <div class="mx-auto max-w-4xl space-y-32">
          <!-- Focus -->
          <div class="reveal flex flex-col md:flex-row items-center gap-12">
            <div class="flex-1 space-y-4">
              <UBadge
                :label="$t('welcome.features.focus.badge')"
                color="primary"
                variant="subtle"
              />
              <h2 class="text-3xl font-bold">
                {{ $t('welcome.features.focus.title') }}
              </h2>
              <p class="text-lg text-muted">
                {{ $t('welcome.features.focus.description') }}
              </p>
              <div class="flex gap-2 pt-2 text-muted">
                <UIcon
                  name="i-lucide-layout-dashboard"
                  class="size-5"
                />
                <UIcon
                  name="i-lucide-git-pull-request"
                  class="size-5"
                />
                <UIcon
                  name="i-lucide-bell"
                  class="size-5"
                />
              </div>
            </div>
            <!-- Mockup: Focus dashboard with PR rows -->
            <div class="flex-1 w-full">
              <div class="rounded-xl border border-default bg-elevated/50 p-4 space-y-3">
                <div class="flex items-center gap-2 pb-2 border-b border-default">
                  <div class="size-2 rounded-full bg-green-500" />
                  <div class="h-3 w-32 rounded bg-muted/30" />
                  <div class="ml-auto">
                    <UBadge
                      :label="$t('welcome.features.focus.mockup.merged')"
                      color="primary"
                      variant="subtle"
                      size="xs"
                    />
                  </div>
                </div>
                <div class="flex items-center gap-2 pb-2 border-b border-default">
                  <div class="size-2 rounded-full bg-amber-500" />
                  <div class="h-3 w-40 rounded bg-muted/30" />
                  <div class="ml-auto">
                    <UBadge
                      :label="$t('welcome.features.focus.mockup.review')"
                      color="warning"
                      variant="subtle"
                      size="xs"
                    />
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <div class="size-2 rounded-full bg-red-500" />
                  <div class="h-3 w-28 rounded bg-muted/30" />
                  <div class="ml-auto">
                    <UBadge
                      :label="$t('welcome.features.focus.mockup.failing')"
                      color="error"
                      variant="subtle"
                      size="xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Issues & PRs -->
          <div class="reveal flex flex-col md:flex-row-reverse items-center gap-12">
            <div class="flex-1 space-y-4">
              <UBadge
                :label="$t('welcome.features.issues.badge')"
                color="primary"
                variant="subtle"
              />
              <h2 class="text-3xl font-bold">
                {{ $t('welcome.features.issues.title') }}
              </h2>
              <p class="text-lg text-muted">
                {{ $t('welcome.features.issues.description') }}
              </p>
              <div class="flex gap-2 pt-2 text-muted">
                <UIcon
                  name="i-lucide-circle-dot"
                  class="size-5"
                />
                <UIcon
                  name="i-lucide-filter"
                  class="size-5"
                />
                <UIcon
                  name="i-lucide-search"
                  class="size-5"
                />
              </div>
            </div>
            <!-- Mockup: Issue list with filter chips -->
            <div class="flex-1 w-full">
              <div class="rounded-xl border border-default bg-elevated/50 p-4 space-y-3">
                <div class="flex gap-2 pb-2 border-b border-default">
                  <div class="h-6 px-3 rounded-full bg-primary/10 text-primary text-xs flex items-center">
                    {{ $t('welcome.features.issues.mockup.open') }}
                  </div>
                  <div class="h-6 px-3 rounded-full bg-muted/20 text-muted text-xs flex items-center">
                    {{ $t('welcome.features.issues.mockup.closed') }}
                  </div>
                  <div class="h-6 px-3 rounded-full bg-muted/20 text-muted text-xs flex items-center">
                    {{ $t('welcome.features.issues.mockup.assigned') }}
                  </div>
                </div>
                <div class="flex items-center gap-2 pb-2 border-b border-default">
                  <UIcon
                    name="i-lucide-circle-dot"
                    class="size-4 text-green-500 shrink-0"
                  />
                  <div class="h-3 w-36 rounded bg-muted/30" />
                  <div class="ml-auto h-3 w-8 rounded bg-muted/20" />
                </div>
                <div class="flex items-center gap-2 pb-2 border-b border-default">
                  <UIcon
                    name="i-lucide-circle-dot"
                    class="size-4 text-green-500 shrink-0"
                  />
                  <div class="h-3 w-44 rounded bg-muted/30" />
                  <div class="ml-auto h-3 w-8 rounded bg-muted/20" />
                </div>
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-lucide-circle-check"
                    class="size-4 text-purple-500 shrink-0"
                  />
                  <div class="h-3 w-32 rounded bg-muted/30" />
                  <div class="ml-auto h-3 w-8 rounded bg-muted/20" />
                </div>
              </div>
            </div>
          </div>

          <!-- Notifications -->
          <div class="reveal flex flex-col md:flex-row items-center gap-12">
            <div class="flex-1 space-y-4">
              <UBadge
                :label="$t('welcome.features.notifications.badge')"
                color="primary"
                variant="subtle"
              />
              <h2 class="text-3xl font-bold">
                {{ $t('welcome.features.notifications.title') }}
              </h2>
              <p class="text-lg text-muted">
                {{ $t('welcome.features.notifications.description') }}
              </p>
              <div class="flex gap-2 pt-2 text-muted">
                <UIcon
                  name="i-lucide-bell"
                  class="size-5"
                />
                <UIcon
                  name="i-lucide-inbox"
                  class="size-5"
                />
                <UIcon
                  name="i-lucide-check-check"
                  class="size-5"
                />
              </div>
            </div>
            <!-- Mockup: Notification inbox rows -->
            <div class="flex-1 w-full">
              <div class="rounded-xl border border-default bg-elevated/50 p-4 space-y-3">
                <div class="flex items-center gap-3 pb-2 border-b border-default">
                  <div class="size-8 rounded-full bg-primary/20 shrink-0" />
                  <div class="flex-1 space-y-1">
                    <div class="h-3 w-36 rounded bg-muted/30" />
                    <div class="h-2 w-24 rounded bg-muted/20" />
                  </div>
                  <div class="size-2 rounded-full bg-primary shrink-0" />
                </div>
                <div class="flex items-center gap-3 pb-2 border-b border-default">
                  <div class="size-8 rounded-full bg-primary/20 shrink-0" />
                  <div class="flex-1 space-y-1">
                    <div class="h-3 w-44 rounded bg-muted/30" />
                    <div class="h-2 w-20 rounded bg-muted/20" />
                  </div>
                  <div class="size-2 rounded-full bg-primary shrink-0" />
                </div>
                <div class="flex items-center gap-3">
                  <div class="size-8 rounded-full bg-muted/20 shrink-0" />
                  <div class="flex-1 space-y-1">
                    <div class="h-3 w-32 rounded bg-muted/30" />
                    <div class="h-2 w-16 rounded bg-muted/20" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Profile -->
          <div class="reveal flex flex-col md:flex-row-reverse items-center gap-12">
            <div class="flex-1 space-y-4">
              <UBadge
                :label="$t('welcome.features.profile.badge')"
                color="primary"
                variant="subtle"
              />
              <h2 class="text-3xl font-bold">
                {{ $t('welcome.features.profile.title') }}
              </h2>
              <p class="text-lg text-muted">
                {{ $t('welcome.features.profile.description') }}
              </p>
              <div class="flex gap-2 pt-2 text-muted">
                <UIcon
                  name="i-lucide-user"
                  class="size-5"
                />
                <UIcon
                  name="i-lucide-file-text"
                  class="size-5"
                />
                <UIcon
                  name="i-lucide-link"
                  class="size-5"
                />
              </div>
            </div>
            <!-- Mockup: Mini profile card -->
            <div class="flex-1 w-full">
              <div class="rounded-xl border border-default bg-elevated/50 p-6 flex flex-col items-center gap-4">
                <div class="size-16 rounded-full bg-primary/20" />
                <div class="space-y-2 text-center">
                  <div class="h-4 w-28 mx-auto rounded bg-muted/30" />
                  <div class="h-3 w-20 mx-auto rounded bg-muted/20" />
                </div>
                <div class="h-3 w-48 rounded bg-muted/20" />
                <div class="flex gap-3 text-muted">
                  <UIcon
                    name="i-lucide-github"
                    class="size-5"
                  />
                  <UIcon
                    name="i-lucide-twitter"
                    class="size-5"
                  />
                  <UIcon
                    name="i-lucide-globe"
                    class="size-5"
                  />
                  <UIcon
                    name="i-lucide-mail"
                    class="size-5"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Open Source Strip -->
      <section class="reveal py-12 px-6 bg-primary/5 border-y border-primary/20">
        <div class="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-center gap-6 text-center sm:text-left">
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-github"
              class="size-8 text-primary shrink-0"
            />
            <div>
              <p class="font-semibold">
                {{ $t('welcome.openSource.label') }}
              </p>
              <p class="text-sm text-muted">
                {{ $t('welcome.openSource.description') }}
              </p>
            </div>
          </div>
          <UButton
            :label="$t('welcome.openSource.cta')"
            icon="i-lucide-external-link"
            variant="outline"
            to="https://github.com/flumen-dev/flumen.dev"
            target="_blank"
          />
        </div>
      </section>

      <!-- Bottom CTA -->
      <section class="reveal py-24 px-6 text-center bg-linear-to-b from-transparent via-primary/5 to-primary/10">
        <h2 class="text-3xl font-bold mb-4">
          {{ $t('welcome.cta.title') }}
        </h2>
        <p class="text-lg text-muted mb-8">
          {{ $t('welcome.cta.description') }}
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

/* Scroll reveal — visible by default, hidden only when JS adds .reveal-hidden */
.reveal {
  transition: opacity 0.7s ease-out, transform 0.7s ease-out, filter 0.7s ease-out;
}

.reveal.reveal-hidden {
  opacity: 0;
  transform: translateY(24px);
  filter: blur(3px);
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
  .reveal,
  .reveal.reveal-hidden {
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    transition: none !important;
  }
}
</style>
