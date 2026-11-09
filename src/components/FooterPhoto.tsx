import Image from "next/image";

/**
 * The classroom photo behind every footer (student site and portals), darkened so the
 * footer's light text stays readable. Place it first inside a `relative overflow-hidden` footer.
 */
export default function FooterPhoto() {
  return (
    <>
      <Image
        src="/footer-classroom.png"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-[center_40%] pointer-events-none"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-ink-strong/80 pointer-events-none" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-strong/20 to-ink-strong/80 pointer-events-none" />
    </>
  );
}
