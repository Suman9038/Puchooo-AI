from pydantic import BaseModel


class TranscriptSegment(BaseModel):
    text: str
    start:float
    duration:float


class TranscriptResponse(BaseModel):
    video_id: str
    language_code:str
    segments:list[TranscriptSegment]