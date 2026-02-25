export default function VerifiedBadge({ platform }: { platform: string }) {
  const color = platform === "youtube" ? "#aaa" : "#20D5EC";
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="10" fill={color} />
      <path d="M8.5 13.5L5 10l1.4-1.4 2.1 2.1 4.6-4.6L14.5 7.5l-6 6z" fill="#fff" />
    </svg>
  );
}