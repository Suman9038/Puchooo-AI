from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from app.schemas.transcript_schema import TranscriptResponse
from app.core.logger import logger


class TranscriptChunkerService:
    """
    This TranscriptChunkerService Responsible For:
    1. Converting transcript segments into LangChain Documents
    2. Preserving timestamp metadata
    3. Splitting large documents into chunks
    """
    def __init__(self, chunk_size: int = 1200, chunk_overlap: int = 150,):
        self.chunk_size = chunk_size
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size = chunk_size,
            chunk_overlap = chunk_overlap,
            length_function = len,
            separators = [
                "\n\n",
                "\n",
                " ",
                "",
            ]
        )

    def create_documents(self, transcript: TranscriptResponse)-> list[Document]:
        """Converting the Transcript Response object into Langchain Documen Object"""
        docs = []
        
        for segment in transcript.segments:
            docs.append(Document(
                page_content = segment.text,
                metadata = {
                    "video_id": transcript.video_id,
                    "language": transcript.language_code,
                    "start": segment.start, 
                    "duration": segment.duration
                }
            ))

        return docs

    def split_document(self, docs: list[Document]) -> list[Document]:
        return self.splitter.split_documents(docs)

    def chunk_transcript(
        self,
        transcript: TranscriptResponse,
    ) -> list[Document]:

        logger.info(
            f"Starting chunking for video_id={transcript.video_id}"
        )

        documents = self._build_documents(transcript)

        chunked_documents = self.splitter.split_documents(
            documents
        )

        logger.info(
            f"Chunking completed | "
            f"video_id={transcript.video_id} | "
            f"documents={len(documents)} | "
            f"chunks={len(chunked_documents)}"
        )

        return chunked_documents


    def _build_documents(
        self,
        transcript: TranscriptResponse,
    ) -> list[Document]:

        documents: list[Document] = []

        current_segments = []
        current_length = 0

        for segment in transcript.segments:

            segment_length = len(segment.text)

            if (
                current_segments
                and current_length + segment_length
                > self.chunk_size
            ):

                documents.append(
                    self._create_document(
                        transcript=transcript,
                        segments=current_segments,
                    )
                )

                current_segments = []
                current_length = 0

            current_segments.append(segment)
            current_length += segment_length

        if current_segments:

            documents.append(
                self._create_document(
                    transcript=transcript,
                    segments=current_segments,
                )
            )

        return documents

    def _create_document(
        self,
        transcript: TranscriptResponse,
        segments,
    ) -> Document:

        first_segment = segments[0]
        last_segment = segments[-1]

        page_content = " ".join(
            segment.text
            for segment in segments
        )

        return Document(
            page_content=page_content,
            metadata={
                "video_id": transcript.video_id,
                "language": transcript.language_code,
                "start_time": first_segment.start,
                "end_time": (
                    last_segment.start
                    + last_segment.duration
                ),
            },
        )

        