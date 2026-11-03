import time
import urllib.request
from typing import List, Optional, Tuple, Any
import requests
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import GenericProxyConfig
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
from app.core.logger import logger
from app.core.config import settings


class TimeoutSession(requests.Session):
    """
    Enforces strict connect and read timeouts on all requests.
    Prevents Celery worker threads from hanging indefinitely on dead proxies.
    """
    def __init__(self, timeout: float = 5.0):
        super().__init__()
        self.default_timeout = timeout

    def request(self, *args, **kwargs):
        if 'timeout' not in kwargs or kwargs['timeout'] is None:
            kwargs['timeout'] = self.default_timeout
        return super().request(*args, **kwargs)


class TranscriptProxyManager:
    """
    Multi-layer resilient proxy manager for YouTube transcripts:
    - Layer 1: FreeProxyApi (SOCKS5 / HTTP)
    - Layer 2: ProxyScrape (High-anonymity SOCKS5)
    - Fallback: Direct YouTube connection (Default for local development)
    """

    def __init__(self):
        self.enabled = getattr(settings, "ENABLE_TRANSCRIPT_PROXY", False)
        self.api_key = getattr(settings, "FREE_PROXY_API", "")
        self._cached_working_proxy: Optional[str] = None
        self._cached_proxy_time: float = 0
        self._cache_ttl: float = 900  # 15 minutes

    def get_layer1_freeproxyapi(self) -> List[str]:
        """Layer 1: Scrape SOCKS5 and HTTP proxies from FreeProxyApi"""
        if not self.api_key:
            return []
        url = f"https://www.freeproxyapi.com/full?key={self.api_key}"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=6) as resp:
                text = resp.read().decode('utf-8', errors='ignore')
                proxies = []
                for line in text.splitlines():
                    line = line.strip()
                    if line.startswith("socks5://") or line.startswith("http://"):
                        proxies.append(line)
                return proxies
        except Exception as e:
            logger.warning(f"[ProxyManager] Layer 1 (FreeProxyApi) fetch failed: {e}")
            return []

    def get_layer2_proxyscrape(self) -> List[str]:
        """Layer 2: Scrape high-anonymity SOCKS5 proxies from ProxyScrape"""
        url = "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=4000&country=all&ssl=all&anonymity=elite"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=6) as resp:
                text = resp.read().decode('utf-8', errors='ignore')
                return [f"socks5://{line.strip()}" for line in text.splitlines() if line.strip() and ":" in line]
        except Exception as e:
            logger.warning(f"[ProxyManager] Layer 2 (ProxyScrape) fetch failed: {e}")
            return []

    def fetch_transcript(self, video_id: str, languages: Tuple[str, ...] = ("en", "hi", "hi-IN")) -> Any:
        """
        Attempts to fetch transcript using cached proxy, Layer 1, Layer 2, or direct connection.
        """
        # If proxy is disabled (default for local development), use direct connection
        if not self.enabled:
            logger.info("[ProxyManager] Proxy disabled. Fetching directly (Local mode)...")
            yt = YouTubeTranscriptApi()
            return yt.list(video_id).find_transcript(list(languages)).fetch()

        now = time.time()
        # 0. Check cached working proxy
        if self._cached_working_proxy and (now - self._cached_proxy_time < self._cache_ttl):
            logger.info(f"[ProxyManager] Attempting with cached working proxy: {self._cached_working_proxy}")
            result = self._try_proxy(self._cached_working_proxy, video_id, languages)
            if result is not None:
                return result
            logger.info("[ProxyManager] Cached proxy failed or expired, resetting cache.")
            self._cached_working_proxy = None

        # 1. Layer 1: FreeProxyApi
        logger.info("[ProxyManager] Fetching Layer 1 (FreeProxyApi) proxies...")
        l1_proxies = self.get_layer1_freeproxyapi()
        socks5_l1 = [p for p in l1_proxies if p.startswith("socks5://")]
        other_l1 = [p for p in l1_proxies if not p.startswith("socks5://")]
        candidates_l1 = socks5_l1[:5] + other_l1[:3]

        for proxy in candidates_l1:
            logger.info(f"[ProxyManager] Trying Layer 1 proxy: {proxy}")
            result = self._try_proxy(proxy, video_id, languages)
            if result is not None:
                self._cached_working_proxy = proxy
                self._cached_proxy_time = time.time()
                logger.info(f"[ProxyManager] Layer 1 proxy succeeded and cached: {proxy}")
                return result

        # 2. Layer 2: ProxyScrape SOCKS5
        logger.info("[ProxyManager] Layer 1 failed/exhausted. Fetching Layer 2 (ProxyScrape) SOCKS5 proxies...")
        l2_proxies = self.get_layer2_proxyscrape()
        for proxy in l2_proxies[:8]:
            logger.info(f"[ProxyManager] Trying Layer 2 proxy: {proxy}")
            result = self._try_proxy(proxy, video_id, languages)
            if result is not None:
                self._cached_working_proxy = proxy
                self._cached_proxy_time = time.time()
                logger.info(f"[ProxyManager] Layer 2 proxy succeeded and cached: {proxy}")
                return result

        # 3. Layer 3: Direct connection fallback
        logger.warning("[ProxyManager] All proxies failed. Attempting direct connection fallback...")
        yt = YouTubeTranscriptApi()
        return yt.list(video_id).find_transcript(list(languages)).fetch()

    def _try_proxy(self, proxy_url: str, video_id: str, languages: Tuple[str, ...]) -> Optional[Any]:
        try:
            config = GenericProxyConfig(http_url=proxy_url, https_url=proxy_url)
            session = TimeoutSession(timeout=5.0)
            session.proxies = config.to_requests_dict()
            yt = YouTubeTranscriptApi(proxy_config=config, http_client=session)
            transcript_list = yt.list(video_id)
            transcript = transcript_list.find_transcript(list(languages))
            data = transcript.fetch()
            return data
        except (TranscriptsDisabled, NoTranscriptFound) as e:
            # Transcript is genuinely disabled or not in target language on the video itself
            logger.info(f"[ProxyManager] Video status from YouTube: {e}")
            raise e
        except Exception as e:
            logger.debug(f"[ProxyManager] Proxy {proxy_url} failed with {type(e).__name__}: {e}")
            return None


proxy_manager = TranscriptProxyManager()

