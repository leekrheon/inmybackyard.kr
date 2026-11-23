/** Figma 덱에서 추출한 브랜드 에셋 경로. public/brand/ 아래. */
export const BRAND: { logo: string | null; logoBlack: string | null; symbol: string | null } = {
  logo: '/brand/imby-logo-white.png',
  logoBlack: '/brand/imby-logo-black.png',
  symbol: '/brand/imby-mower.png',
};

/** 클라이언트 로고 4개 (모두 흰색 벡터, public/brand/clients/) */
export const CLIENT_LOGOS: { name: string; logo: string | null; to: string }[] = [
  { name: '흑백개발자 THE 해커톤', logo: '/brand/clients/hackathon-white.svg', to: '/work/the-hackathon' },
  { name: 'Narrative', logo: '/brand/clients/narrative-white.svg', to: '/work/narrative-seongsu-ooh' },
  { name: 'THE ZONE BIO', logo: '/brand/clients/thezonebio-white.svg', to: '/work/lockin-coffee' },
  { name: 'Tiro', logo: '/brand/clients/tiro-white.svg', to: '/work/tiro-sagwan' },
]
