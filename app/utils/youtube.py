from urllib.parse import urlparse, parse_qs
import urllib.request
import json
from fastapi import HTTPException, status
from app.core.exceptions import (InvalidYoutubeURL,InvalidYoutubeVideoID)


class YoutubeUtils:
    """
    Utility class for YouTube URL operations.

    Responsibilities:
    - Validate YouTube URL
    - Extract YouTube Video ID
    - Normalize YouTube URL
    """

    @staticmethod
    def extract_video_id(url: str) -> str:
        """
        Extract YouTube video ID from supported URL formats.

        Supported formats:

        https://www.youtube.com/watch?v=VIDEO_ID
        https://youtu.be/VIDEO_ID
        https://youtube.com/shorts/VIDEO_ID
        https://youtube.com/embed/VIDEO_ID
        https://m.youtube.com/watch?v=VIDEO_ID
        """

        try:
            parsed = urlparse(url)

            host = parsed.netloc.lower()
            path = parsed.path

            # youtu.be/<id>
            if host in ("youtu.be", "www.youtu.be"):
                video_id = path.lstrip("/")

            # youtube.com/watch?v=<id>
            elif "youtube.com" in host:
                if path == "/watch":
                    query = parse_qs(parsed.query)
                    video_id = query.get("v", [None])[0]

                elif path.startswith("/shorts/"):
                    video_id = path.split("/")[2]

                elif path.startswith("/embed/"):
                    video_id = path.split("/")[2]

                else:
                    video_id = None

            else:
                video_id = None

            if not video_id:
                raise InvalidYoutubeURL()

            YoutubeUtils.validate_video_id(video_id)

            return video_id

        except HTTPException:
            raise

        except Exception:
            raise InvalidYoutubeURL()

    @staticmethod
    def normalize_url(video_id: str) -> str:
        """
        Return canonical YouTube URL.
        """

        YoutubeUtils.validate_video_id(video_id)

        return f"https://www.youtube.com/watch?v={video_id}"

    @staticmethod
    def validate_video_id(video_id: str) -> None:
        """
        Validate YouTube video id.

        YouTube IDs are generally 11 characters.
        """

        if not video_id:
            raise InvalidYoutubeVideoID()

        if len(video_id) != 11:
            raise InvalidYoutubeVideoID()

    @staticmethod
    def is_valid_youtube_url(url: str) -> bool:
        """
        Return True if URL is a valid YouTube URL.
        """

        try:
            YoutubeUtils.extract_video_id(url)
            return True
        except HTTPException:
            return False

    @staticmethod
    def get_video_metadata(youtube_url: str) -> dict:
        """
        Fetch video title and thumbnail URL using YouTube oEmbed API.
        """
        oembed_url = f"https://www.youtube.com/oembed?url={youtube_url}&format=json"
        try:
            with urllib.request.urlopen(oembed_url) as response:
                data = json.loads(response.read().decode())
                return {
                    "title": data.get("title", "Unknown Title"),
                    "thumbnail_url": data.get("thumbnail_url")
                }
        except Exception:
            # Fallback if oEmbed fails
            return {
                "title": "Unknown Title",
                "thumbnail_url": None
            }