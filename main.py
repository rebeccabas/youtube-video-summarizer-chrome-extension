# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import google.generativeai as genai
import os
from dotenv import load_dotenv
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Verify Google API key is present
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    logger.error("GOOGLE_API_KEY not found in environment variables")
    raise ValueError("GOOGLE_API_KEY not configured")

# Configure Gemini AI
genai.configure(api_key=GOOGLE_API_KEY)

# Models
class ChatMessage(BaseModel):
    message: str
    video_id: str

class ChatResponse(BaseModel):
    response: str

# Simple in-memory chat history
chat_history = []

def get_youtube_transcript(video_id: str) -> str:
    try:
        logger.info(f"Fetching transcript for video ID: {video_id}")
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        transcript_text = ' '.join([entry['text'] for entry in transcript_list])
        logger.info(f"Successfully fetched transcript for video ID: {video_id}")
        return transcript_text
    except (TranscriptsDisabled, NoTranscriptFound) as e:
        logger.error(f"No transcript found for video ID {video_id}: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=f"No transcript found for video ID: {video_id}"
        )
    except Exception as e:
        logger.error(f"Error fetching transcript for video ID {video_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching transcript: {str(e)}"
        )

def get_gemini_response(message: str, transcript: str) -> str:
    try:
        logger.info("Generating Gemini AI response")
        model = genai.GenerativeModel("gemini-pro")
        
        prompt = f"""You are a helpful AI assistant for YouTube lectures. 
        Answer the user's question based on the lecture transcript below. 
        If the question cannot be answered from the transcript, politely say so.

        Lecture Transcript:
        {transcript}

        User Question: {message}
        """

        response = model.generate_content(prompt)
        logger.info("Successfully generated AI response")
        return response.text

    except Exception as e:
        logger.error(f"Error generating AI response: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating AI response: {str(e)}"
        )

@app.post("/chat")
async def chat_endpoint(chat_message: ChatMessage):
    try:
        logger.info(f"Received chat request for video ID: {chat_message.video_id}")
        
        # Validate video ID
        if not chat_message.video_id:
            raise HTTPException(
                status_code=400,
                detail="Video ID is required"
            )
        
        # Get transcript
        transcript = get_youtube_transcript(chat_message.video_id)
        
        # Get AI response
        ai_response = get_gemini_response(
            chat_message.message,
            transcript
        )
        
        # Store in chat history
        chat_history.append({
            "message": chat_message.message,
            "response": ai_response,
            "timestamp": datetime.utcnow()
        })
        
        logger.info("Successfully processed chat request")
        return ChatResponse(response=ai_response)

    except HTTPException as e:
        logger.error(f"HTTP Exception in chat endpoint: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in chat endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@app.get("/chat-history")
async def get_chat_history():
    return chat_history

@app.get("/transcript/{video_id}")
async def get_transcript_endpoint(video_id: str):
    transcript = get_youtube_transcript(video_id)
    return {"transcript": transcript}

@app.get("/health")
async def health_check():
    return {"status": "ok", "api_key_configured": bool(GOOGLE_API_KEY)}