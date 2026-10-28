
export async function onRequestGet(context) {
  const channelId = context.env.YOUTUBE_CHANNEL_ID;

  if (!channelId || !/^UC[\w-]{22}$/.test(channelId)) {
    return Response.json(
      { error: "YouTube channel not configured" },
      { status: 503 }
    );
  }

  try {
    const feedUrl =
      "https://www.youtube.com/feeds/videos.xml?channel_id=" +
      encodeURIComponent(channelId);

    const response = await fetch(feedUrl);

    if (!response.ok) {
      throw new Error("YouTube feed unavailable");
    }

    const xml = await response.text();
    const match = xml.match(
      /<yt:videoId>([a-zA-Z0-9_-]{11})<\/yt:videoId>/
    );

    if (!match) {
      throw new Error("No public videos found");
    }

    return Response.json(
      { videoId: match[1] },
      {
        headers: {
          "Cache-Control": "public, max-age=1800"
        }
      }
    );
  } catch (error) {
    return Response.json(
      { error: "Unable to retrieve latest video" },
      { status: 502 }
    );
  }
}
