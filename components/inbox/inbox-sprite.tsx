import Image from "next/image";

export function InboxSprite({size = 20}: {size?: number}) {
  return <Image src="/icons/inbox.png" alt="" aria-hidden="true" width={size} height={size} className="inbox-sprite" />;
}
