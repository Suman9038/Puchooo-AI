import os
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_ollama import OllamaEmbeddings
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from dotenv import load_dotenv
from functools import lru_cache
load_dotenv()


class GetEmbeddingModels:
    @staticmethod
    @lru_cache(maxsize=1)
    def get_fastembed_models(model_name: str = None):
        """
        FastEmbed In-Process Multilingual Embeddings (Qdrant).
        100% Free Forever, runs on CPU in ~150MB RAM, zero rate limits, no cloud API quota.
        Supports Hindi, Hinglish, English, and 50+ languages with 768 dimensions (matches Qdrant).
        """
        resolved_model = model_name or os.getenv(
            "FASTEMBED_MODEL",
            "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
        )
        return FastEmbedEmbeddings(
            model_name=resolved_model,
            cache_dir=".embeddings/.cache"
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_ollama_embedding_models(
        base_url: str = None,
        model: str = None
    ):
        """
        Local Ollama embedding models (100% free, 0 rate limits, unlimited chunks).
        Active for local development when Ollama daemon is running.
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
        """Using google's embedding models (Cloud - 768 dimensions matched to Qdrant)"""
        return GoogleGenerativeAIEmbeddings(
            model="gemini-embedding-001",
            output_dimensionality=768
        )

    @staticmethod
    @lru_cache(maxsize=1)
    def get_hf_embedding_models():
        """Using huggingface's embedding models"""
        return HuggingFaceEmbeddings(
           model_name="ibm-granite/granite-embedding-97m-multilingual-r2",
           cache_folder=".embeddings/.cache"
        )
