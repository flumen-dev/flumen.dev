<script setup lang="ts">
const props = withDefaults(defineProps<{
  color?: string
  width?: string
  height?: string
}>(), {
  color: 'text-primary',
})

const sizeStyle = computed(() => {
  if (props.width && props.height) return { width: props.width, height: props.height }
  if (props.width) return { width: props.width, height: 'auto' }
  if (props.height) return { height: props.height, width: 'auto' }
  return {}
})
</script>

<template>
  <svg
    :class="color"
    :style="sizeStyle"
    class="shrink-0"
    viewBox="18 82 220 94"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid meet"
    aria-label="Flumen Logo"
    role="img"
  >
    <g
      transform="translate(0.000000,256.000000) scale(0.100000,-0.100000)"
      fill="currentColor"
      stroke="none"
    >
      <path
        opacity="0.4"
        d="M677 1304 c93 -34 313 -183 313 -211 0 -17 -124 -102 -219 -150 -184 -93 -343 -93 -439 0 -50 48 -72 97 -72 162 0 90 39 150 128 195 90 45 178 46 289 4z"
      />
      <path
        opacity="0.7"
        d="M1202 1636 c87 -29 348 -169 348 -186 0 -6 -107 -102 -128 -114 -8 -5 -53 19 -122 64 -124 81 -249 141 -330 161 -73 17 -191 16 -265 -4 -32 -9 -61 -14 -63 -12 -13 13 173 98 253 115 73 16 223 5 307 -24z"
      />
      <path
        opacity="0.7"
        d="M906 1515 c98 -23 163 -57 352 -182 302 -200 457 -265 632 -265 65 0 101 6 155 26 38 14 71 24 72 22 2 -1 -23 -29 -54 -61 -140 -144 -321 -211 -496 -184 -137 21 -220 65 -467 250 -88 66 -194 140 -234 164 -146 89 -272 119 -376 91 -30 -8 -56 -13 -58 -11 -5 4 99 85 143 111 88 51 216 66 331 39z"
      />
      <path
        opacity="1"
        fill-rule="evenodd"
        d="M2139 1654 c63 -18 132 -82 151 -138 19 -58 9 -163 -21 -222 -29 -56 -100 -115 -169 -140 -25 -9 -92 -18 -151 -21 -86 -4 -121 -2 -190 16 -82 20 -289 113 -289 130 0 5 66 73 148 152 155 151 218 195 323 223 71 19 134 19 198 0z M1772 1390 c-56 -20 -113 -52 -130 -73 -7 -8 24 -4 89 12 91 22 107 24 167 13 74 -12 109 -34 133 -80 l17 -32 6 35 c22 115 -127 181 -282 125z"
      />
    </g>
  </svg>
</template>
