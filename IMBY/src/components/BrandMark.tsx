/**
 * IMBY 브랜드 마크 자리. Figma에서 추출한 심볼(/brand/imby-symbol.*)이 있으면 그걸 쓰고,
 * 없으면 아무것도 그리지 않는다 (가짜 로고를 만들지 않는다).
 */
import { BRAND } from '../lib/brand';

export default function BrandMark({ className = '' }: { className?: string }) {
  if (!BRAND.symbol) return null;
  return <img className={`brand-mark ${className}`} src={BRAND.symbol} alt="" aria-hidden="true" />;
}
