import re
from youtube_transcript_api import (
    YouTubeTranscriptApi, 
    TranscriptsDisabled, 
    NoTranscriptFound
    )
from app.core.logger import logger
from app.schemas.transcript_schema import (
    TranscriptResponse,
    TranscriptSegment
    )



class YoutubeTranscriptService:
    """
    This Class is Responsible For :
    1. Fetching the Transcription
    2. Cleaning the Transcript
    3. Converting transcript into structured segment
    4. Returning the TranscriptResponse
    """

    CLEANUP_PATTERN = re.compile(r"\[.*?\]")    

    def __init__(self):
        # Creating a YouTubeTranscriptApi instance
        self.yt_api = YouTubeTranscriptApi()

    def fetch_transcription(self, video_id:str):
        logger.info(f"***** Fetching Transcription for the video {video_id} *****")
        try:
            # getting the transcript list of a video 
            transcript = self._get_transcript_list(video_id)

            # Segemnting the FetchTrancriptSnippet Object 
            segments = self._build_segment(
                transcript=transcript
            )

            logger.info(f"Transcript Segmented Successfully{segments[0]}")

            response = TranscriptResponse(
                video_id= transcript.video_id,
                language_code= transcript.language_code,
                segments=segments
            )
            print(response.model_dump())
            logger.info(
                f"Transcript fetched successfully | "
                f"video_id={video_id} | "
                f"segments={len(segments)}"
            )

            return response

        except TranscriptsDisabled:
            logger.error("transcription is disabled for this Video")
            return None
        
        except NoTranscriptFound:
            logger.error(f"No English or Hindi transcription found for: {video_id}")
            return None

        except Exception as e:
            logger.error(f"Error fetching transcription: {e}")
            return None

    def _get_transcript_list(self,video_id:str):
        transcript_list = self.yt_api.list(
            video_id
        )

        transcript_obj = transcript_list.find_transcript(
            ["en","hi","hi-IN"]
        )

        transcript_response = transcript_obj.fetch()

        return transcript_response

    def _clean_text(self, text:str):
        return(
            self.CLEANUP_PATTERN.sub("", text).strip()
        )

    def _build_segment(self,transcript)-> list[TranscriptSegment]:
        """Converting the FetchedTranscript Object into the Transcript Segment Object"""
        segment: list[TranscriptSegment] = []
        for snippet in transcript:
            cleaned_test = self._clean_text(
                snippet.text
            )
            if not cleaned_test:
                continue

            segment.append(
                TranscriptSegment(
                    text= cleaned_test,
                    start= snippet.start,
                    duration= snippet.duration
                )
            )
        return segment

            

# def processing_hindi_to_english(text: str):

#     logger.info("***** Processing Hindi to English (Batch Mode) *****")
#     fn_start = time.time()
#     try:

#         # 1000 chars × 4 batch × 9 (URL-encoded Hindi) = ~36,000 char URL → safe for Google
#         max_char = 1500
#         batch_size = 4
#         chunks = [text[i:i + max_char] for i in range(0, len(text), max_char)]
#         total_chunks = len(chunks)
#         total_batches = -(-total_chunks // batch_size)  # ceiling division
#         logger.info(f"Total chunks: {total_chunks} | Batches of {batch_size}: {total_batches}")

#         translated_parts = []
#         translator = GoogleTranslator(source="hi", target="en")

#         for i in range(0, total_chunks, batch_size):
#             current_batch = chunks[i : i + batch_size]
#             batch_num = (i // batch_size) + 1
#             batch_start = time.time()
#             logger.info(f"Translating batch {batch_num} of {total_batches} ({len(current_batch)} chunks)...")

#             # translate_batch sends all chunks in one request
#             translated_batch = translator.translate_batch(current_batch)

#             # Filter out None values to avoid TypeError in join
#             translated_parts.extend([t for t in translated_batch if t is not None])

#             logger.info(f"Batch {batch_num} done in {time.time() - batch_start:.2f}s")

#             # Rate limiting between batches
#             if i + batch_size < total_chunks:
#                 time.sleep(1)

#         translated_text = " ".join(translated_parts)
#         logger.info(f"Translation complete in {time.time() - fn_start:.2f}s | Preview: {translated_text[:50]}...")

#         return translated_text

#     except Exception as e:
#         logger.error(f"Error in translation after {time.time() - fn_start:.2f}s: {e}")
#         # Return original text as a fallback so the pipeline doesn't break
#         return text



if __name__ == "__main__":
    service = YoutubeTranscriptService()
    service.fetch_transcription("2zvXrbjyXZc")