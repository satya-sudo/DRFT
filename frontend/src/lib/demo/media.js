function artworkDataURI(label, colors) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 720">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors[0]}" />
          <stop offset="100%" stop-color="${colors[1]}" />
        </linearGradient>
      </defs>
      <rect width="640" height="720" rx="52" fill="url(#bg)" />
      <circle cx="506" cy="146" r="96" fill="rgba(255,255,255,0.15)" />
      <circle cx="182" cy="534" r="166" fill="rgba(255,255,255,0.18)" />
      <rect x="76" y="92" width="488" height="536" rx="38" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.22)" />
      <text x="74" y="654" font-size="52" font-family="Avenir Next, Helvetica Neue, sans-serif" fill="white">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function buildDemoMedia() {
  return [
    {
      id: "m-1",
      fileName: "Monsoon Walk",
      mediaType: "image",
      mimeType: "image/jpeg",
      sizeBytes: 4240192,
      takenAt: "2026-04-06T18:32:00.000Z",
      previewUrl: artworkDataURI("Monsoon Walk", ["#274690", "#7cb4f6"])
    },
    {
      id: "m-2",
      fileName: "Studio Shelf",
      mediaType: "image",
      mimeType: "image/jpeg",
      sizeBytes: 3891023,
      takenAt: "2026-04-06T16:12:00.000Z",
      previewUrl: artworkDataURI("Studio Shelf", ["#955251", "#d6a77a"])
    },
    {
      id: "m-3",
      fileName: "Late Train",
      mediaType: "video",
      mimeType: "video/mp4",
      sizeBytes: 218419023,
      takenAt: "2026-04-05T21:04:00.000Z",
      previewUrl: artworkDataURI("Late Train", ["#1d3557", "#457b9d"])
    },
    {
      id: "m-4",
      fileName: "Cafe Window",
      mediaType: "image",
      mimeType: "image/jpeg",
      sizeBytes: 5239012,
      takenAt: "2026-04-05T10:22:00.000Z",
      previewUrl: artworkDataURI("Cafe Window", ["#e07a5f", "#f2cc8f"])
    },
    {
      id: "m-5",
      fileName: "Midnight Render",
      mediaType: "image",
      mimeType: "image/png",
      sizeBytes: 2109821,
      takenAt: "2026-04-04T23:16:00.000Z",
      previewUrl: artworkDataURI("Midnight Render", ["#3d405b", "#81b29a"])
    },
    {
      id: "m-6",
      fileName: "Rooftop Drift",
      mediaType: "video",
      mimeType: "video/mp4",
      sizeBytes: 411209823,
      takenAt: "2026-04-04T17:48:00.000Z",
      previewUrl: artworkDataURI("Rooftop Drift", ["#0f4c5c", "#2c7da0"])
    },
    {
      id: "m-7",
      fileName: "Morning Table",
      mediaType: "image",
      mimeType: "image/jpeg",
      sizeBytes: 3218004,
      takenAt: "2026-04-03T08:10:00.000Z",
      previewUrl: artworkDataURI("Morning Table", ["#f4a261", "#e76f51"])
    },
    {
      id: "m-8",
      fileName: "Blue Hallway",
      mediaType: "image",
      mimeType: "image/jpeg",
      sizeBytes: 4600012,
      takenAt: "2026-04-03T07:12:00.000Z",
      previewUrl: artworkDataURI("Blue Hallway", ["#4ea8de", "#72efdd"])
    },
    {
      id: "m-9",
      fileName: "Pocket Clips",
      mediaType: "video",
      mimeType: "video/mp4",
      sizeBytes: 128104991,
      takenAt: "2026-04-02T11:40:00.000Z",
      previewUrl: artworkDataURI("Pocket Clips", ["#5a189a", "#9d4edd"])
    },
    {
      id: "m-10",
      fileName: "Quiet Stairwell",
      mediaType: "image",
      mimeType: "image/jpeg",
      sizeBytes: 2941901,
      takenAt: "2026-04-01T18:51:00.000Z",
      previewUrl: artworkDataURI("Quiet Stairwell", ["#283618", "#606c38"])
    }
  ];
}

