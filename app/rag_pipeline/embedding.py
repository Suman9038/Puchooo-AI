import os
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_ollama import OllamaEmbeddings
from dotenv import load_dotenv
from functools import lru_cache
load_dotenv()


class GetEmbeddingModels:
    @staticmethod
    @lru_cache(maxsize=1)
    def get_google_embedding_models():
        """Using google's embedding models (Cloud - 15 RPM / 1500 RPD quota limits)"""
        return GoogleGenerativeAIEmbeddings(
            model="gemini-embedding-001",
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_hf_embedding_models():
        """Using huggingface's embedding models"""
        return HuggingFaceEmbeddings(
           model_name="ibm-granite/granite-embedding-97m-multilingual-r2",
           cache_folder=".embeddings/.cache"
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_ollama_embedding_models(
        base_url: str = None,
        model: str = None
    ):
        """
        Using local Ollama embedding models (100% free, 0 rate limits, unlimited chunks).
        Ideal for large video transcripts without hitting cloud API quotas or 429 errors.
        """
        resolved_base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        resolved_model = model or os.getenv("OLLAMA_EMBED_MODEL", "embeddinggemma:300m")
        return OllamaEmbeddings(
            base_url=resolved_base_url,
            model=resolved_model,
        )
