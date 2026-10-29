import os
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    Filter,
    FieldCondition,
    MatchValue,
    FilterSelector,
    PayloadSchemaType
)
from langchain_qdrant import QdrantVectorStore
from app.rag_pipeline.embedding import GetEmbeddingModels
from app.core.config import settings
from app.core.logger import logger


class QdrantService:
    _instance = None
    _collection_checked = False

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(QdrantService, cls).__new__(cls)
        return cls._instance

    def __init__(self, *args, **kwargs):
        if hasattr(self, "_initialized") and self._initialized:
            return

        # Cloud Qdrant vs Local Qdrant support
        # Checks QDRANT_CLOUD_ENDPOINT, CLOUD_QDRANT_URL, or QDRANT_URL
        qdrant_url = (
            os.getenv("QDRANT_CLOUD_ENDPOINT")
            or os.getenv("CLOUD_QDRANT_URL")
            or os.getenv("QDRANT_URL")
            or (settings.LOCAL_QDRANT_URL if settings.LOCAL_QDRANT_URL and "localhost" not in settings.LOCAL_QDRANT_URL else None)
        )
        qdrant_api_key = (
            os.getenv("QDRANT_CLOUD_API_KEY")
            or os.getenv("CLOUD_QDRANT_API_KEY")
            or os.getenv("QDRANT_API_KEY")
        )

        if qdrant_url:
            logger.info(f"Connecting to Cloud Qdrant cluster: {qdrant_url}")
            self.client = QdrantClient(
                url=qdrant_url,
                api_key=qdrant_api_key,
                check_compatibility=False
            )
        else:
            self.client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT,
                check_compatibility=False
            )

        # Embedding Provider selection:
        # Detect cloud environment (Render sets RENDER=true or PORT)
        is_cloud = bool(os.getenv("RENDER") or os.getenv("PORT"))
        
        # In cloud: default to 'fastembed' (100% free, in-process, multilingual, 768-dim, no API quota)
        # In local: default to 'ollama' (embeddinggemma:300m)
        default_provider = "fastembed" if is_cloud else "ollama"
        emb_provider = os.getenv("EMBEDDING_PROVIDER", default_provider).strip().lower()

        if emb_provider == "fastembed":
            logger.info("Using FastEmbed Multilingual In-Process Embeddings (768-dim, 100% free, 0 rate limits)")
            self.embedding = GetEmbeddingModels.get_fastembed_models()
        elif emb_provider == "ollama":
            # If running in cloud container without Ollama daemon, gracefully use fastembed
            if is_cloud and not os.getenv("OLLAMA_BASE_URL"):
                logger.warning("Cloud environment detected without local Ollama daemon. Automatically using FastEmbed Multilingual.")
                self.embedding = GetEmbeddingModels.get_fastembed_models()
            else:
                logger.info("Using Local Ollama embeddings (embeddinggemma:300m) - 100% free with no rate limits")
                self.embedding = GetEmbeddingModels.get_ollama_embedding_models()
        elif emb_provider == "google":
            logger.info("Using Google Generative AI embeddings (gemini-embedding-001)")
            self.embedding = GetEmbeddingModels.get_google_embedding_models()
        elif emb_provider == "hf":
            logger.info("Using HuggingFace embeddings")
            self.embedding = GetEmbeddingModels.get_hf_embedding_models()
        else:
            logger.info("Using FastEmbed Multilingual In-Process Embeddings (768-dim)")
            self.embedding = GetEmbeddingModels.get_fastembed_models()

        self.collection_name = settings.QDRANT_COLLECTION

        self.create_collection()

        self.vector_store = QdrantVectorStore(
            client=self.client,
            collection_name=self.collection_name,
            embedding=self.embedding
        )
        self._initialized = True

    def create_collection(self):
        if QdrantService._collection_checked:
            return

        try:
            logger.info(f"Checking/Creating collection {self.collection_name} in Qdrant...")
            
            # Check if collection exists
            if self.client.collection_exists(self.collection_name):
                info = self.client.get_collection(self.collection_name)
                existing_size = info.config.params.vectors.size
                if existing_size != settings.EMBEDDING_DIMENSION:
                    logger.warning(
                        f"⚠️ Dimension mismatch! Collection '{self.collection_name}' has size {existing_size}, "
                        f"but current settings require {settings.EMBEDDING_DIMENSION}."
                    )
                else:
                    logger.info(f"Collection already exists with matching dimension ({existing_size}).")
                
                QdrantService._collection_checked = True
                return

            logger.info(f"Creating collection '{self.collection_name}' with dimension {settings.EMBEDDING_DIMENSION}...")
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=settings.EMBEDDING_DIMENSION,
                    distance=Distance.COSINE,
                )
            )

            # Create payload index for fast video_id filtering at scale
            try:
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.video_id",
                    field_schema=PayloadSchemaType.KEYWORD
                )
                logger.info("Payload index created for 'metadata.video_id'")
            except Exception as index_err:
                logger.warning(f"Note on creating payload index: {index_err}")

            QdrantService._collection_checked = True
        except Exception as e:
            logger.error(f"Failed to check/create Qdrant collection: {e}")

    def add_documents(self, documents, batch_size: int = 32):
        if not documents:
            logger.warning("No documents provided to add to Qdrant.")
            return

        total_docs = len(documents)
        logger.info(f"Adding {total_docs} document chunks to Qdrant (batch_size={batch_size})")

        # Process in batches to handle long video transcripts smoothly without memory spikes
        for i in range(0, total_docs, batch_size):
            batch = documents[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total_docs + batch_size - 1) // batch_size
            logger.info(f"Embedding & indexing batch {batch_num}/{total_batches} ({len(batch)} chunks)...")
            self.vector_store.add_documents(batch)

        logger.info(f"Successfully added all {total_docs} chunks to Qdrant.")

    def get_retriever(self):
        return self.vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": 5,
                "fetch_k": 20
            }
        )

    def get_video_retriever(self, video_id: str):
        logger.info(f"Configuring retriever for video: {video_id}")
        return self.vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": 5,
                "fetch_k": 20,
                "filter": Filter(
                    must=[
                        FieldCondition(
                            key="metadata.video_id",
                            match=MatchValue(value=str(video_id))
                        )
                    ]
                )
            }
        )

    def delete_video_documents(self, video_id: str):
        logger.info(f"Deleting vectors for video: {video_id}")
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[
                        FieldCondition(
                            key="metadata.video_id",
                            match=MatchValue(value=str(video_id))
                        )
                    ]
                )
            )
        )
