import os
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_ollama import OllamaEmbeddings
from dotenv import load_dotenv
from functools import lru_cache
from app.core.logger import logger

load_dotenv()


class GetEmbeddingModels:
    @staticmethod
    @lru_cache(maxsize=1)
    def get_hf_embedding_models(model_name: str = None):
        """
        HuggingFace Multilingual Embedding Model for Cloud (Render).
        Model: ibm-granite/granite-embedding-97m-multilingual-r2
        - Architecture: ModernBERT
        - Context Window: 32,768 tokens
        - Dimensions: 384
        - Memory Footprint: ~190MB (ultra-lightweight, runs within Render 512MB RAM without OOM)
        - Languages: Native English, Hindi, Hinglish + 100+ languages
        """
        resolved_model = model_name or os.getenv(
            "HF_EMBEDDING_MODEL",
            os.getenv("GRANITE_EMBEDDING_MODEL", "ibm-granite/granite-embedding-97m-multilingual-r2")
        )
        cache_folder = os.getenv("HF_HOME") or ".embeddings/.cache"
        try:
            from langchain_huggingface import HuggingFaceEmbeddings
            return HuggingFaceEmbeddings(
                model_name=resolved_model,
                cache_folder=cache_folder
            )
        except (ImportError, Exception) as exc:
            logger.warning(f"Local sentence-transformers not found ({exc}), falling back to HuggingFaceEndpointEmbeddings")
            from langchain_huggingface import HuggingFaceEndpointEmbeddings
            token = os.getenv("HUGGINGFACEHUB_ACCESS_TOKEN") or os.getenv("HF_TOKEN")
            return HuggingFaceEndpointEmbeddings(
                model=resolved_model,
                huggingfacehub_api_token=token
            )

    # Alias for backward compatibility
    get_granite_embedding_models = get_hf_embedding_models

    @staticmethod
    @lru_cache(maxsize=1)
    def get_ollama_embedding_models(
        base_url: str = None,
        model: str = None
    ):
        """
        Local Ollama embedding models (100% free, 0 rate limits, unlimited chunks).
        Active exclusively for local development when Ollama daemon is running.
        """
        resolved_base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        resolved_model = model or os.getenv("OLLAMA_EMBED_MODEL", "embeddinggemma:300m")
        return OllamaEmbeddings(
            base_url=resolved_base_url,
            model=resolved_model,
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_google_embedding_models():
        """Using google's embedding models (Optional Cloud Fallback)"""
        return GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            output_dimensionality=384
        )
