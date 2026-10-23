/** The recorded product walkthrough (served from /public/demo). */
export const DEMO_VIDEO = { src: "/demo/pickmyhire-ai-demo.mp4", poster: "/demo/poster.webp", minutes: 11 };

export function DemoVideo({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-[#DCE4F0] bg-[#0B0F19] shadow-[0_24px_60px_-20px_rgba(11,30,61,0.35)] ${className}`}>
      <video controls preload="none" playsInline poster={DEMO_VIDEO.poster} className="aspect-video w-full bg-[#0B0F19]">
        <source src={DEMO_VIDEO.src} type="video/mp4" />
        Your browser can&apos;t play this video. <a href={DEMO_VIDEO.src}>Download the demo</a>.
      </video>
    </div>
  );
}
