export default function DrftLogo({ className = "", title = "DRFT" }) {
  const svgClassName = className ? `drft-logo ${className}` : "drft-logo";

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={svgClassName}
    >
      <title>{title}</title>
      <path
        d="M49 8c-2.7 6.3-8 11.7-15.3 16.4c-6.3 4-12.2 6.5-17.1 7.9c2.7-4.6 6.6-8.5 11.5-12
        C35.3 15.2 42.5 11.4 49 8Z"
        fill="#f7f7f7"
        opacity="0.98"
      />
      <path
        d="M48.8 8.4c2.3 8.7.5 16-5.5 22.2c-7.3 7.4-19 11.9-35.1 13.5c10.1-3.5 18.1-8 24.2-13.4
        C39.3 24.6 44.8 17.1 48.8 8.4Z"
        fill="#ffffff"
      />
      <path
        d="M10 43.5c7.2-1 13.8-2.6 19.8-4.8C37.8 35.8 44 31.6 48.5 26"
        stroke="#141414"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M38.7 18.2l-2.6 6.2M28.5 24.6l-2.2 5.6M21 30l-2.1 4.8M33.2 34.3l-2 4.7M41.3 28.9l-2.2 5.2"
        stroke="#e6e6e6"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M52.2 10.2l.9 2.5l2.5.9l-2.5.9l-.9 2.5l-.9-2.5l-2.5-.9l2.5-.9l.9-2.5Z"
        fill="#ffffff"
      />
    </svg>
  );
}
