import Image from "next/image";

export function Mascot({ size = 220, className = "" }: { size?: number; className?: string }) {
  return <Image src="/images/miu-mascot.png" alt="Miu, bé mèo đồng hành học TOEIC" width={size} height={Math.round(size * 1331 / 1182)} className={`mascot ${className}`} priority={size > 250} />;
}
